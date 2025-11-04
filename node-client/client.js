// client.js - A simple Express application that uses Passport.js with Auth0 for authentication
// Node.js + Express client using Passport.js + Auth0 to obtain tokens
// and call a protected Spring Boot API with Bearer JWT.

// 1) Dependencies
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const Auth0Strategy = require('passport-auth0');
//const fetch = require('node-fetch'); // or global fetch in newer Node.js versions
require('dotenv').config();

// 2) Environment variables (configure in .env file)
const {
  AUTH0_DOMAIN,
  AUTH0_CLIENT_ID,
  AUTH0_CLIENT_SECRET,
  AUTH0_CALLBACK_URL,
  API_BASE_URL,
  PORT
} = process.env;

if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID || !AUTH0_CLIENT_SECRET || !AUTH0_CALLBACK_URL || !API_BASE_URL || !PORT) {
  console.error('Error: Missing required environment variables. Please check your .env file.');
  process.exit(1);
}

// 3) Express app + session
const app = express();

// Configure session middleware
app.use(session({
  secret: "your-session-secret",
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false, // Set to true if using HTTPS
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  } 
}));

// 4) Passport strategy (Auth0)
passport.use(new Auth0Strategy({

    domain: AUTH0_DOMAIN,
    clientID: AUTH0_CLIENT_ID,
    clientSecret: AUTH0_CLIENT_SECRET,
    callbackURL: AUTH0_CALLBACK_URL
    // audience targets your Auth0 API (Idenitifer) to get an access token suitable for calling your protected (SpringBoot) API. 
    // You can also pass audience via the login route to request appropriate access tokens. For example:
    // authorizationURL: `https://${AUTH0_DOMAIN}/authorize?audience=${AUTH0_API_AUDIENCE}`,
    // tokenURL: `https://${AUTH0_DOMAIN}/oauth/token`
  },
  // Verify callback: store profile + tokens as needed
  function(accessToken, refreshToken, extraParams, profile, done) {
    // Store the access token and refresh token in the user profile for later use. This is just an example; in a production app, you should consider securely storing these tokens (e.g., in a database or encrypted session store).
    const user  = {
        profile,
        accessToken,
        idToken: extraParams && extraParams.id_token,
        tokenType: extraParams && extraParams.token_type,
        expiresIn: extraParams && extraParams.expires_in
    };
    
    return done(null, user);
    

}));
    
// 5) Passport session handling
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));  
app.use(passport.initialize());
app.use(passport.session());

// 6) Helpers
function ensureLoggedIn(req, res, next) {
    if (req.isAuthenticated && req.isAuthenticated()) {
        return next();
    }   
    res.redirect('/login');
}

function homePage(req, res) {
    const loggedIn = req.isAuthenticated && req.isAuthenticated();
    res.send(`
        <h1>Home</h1>
        <p>Status: ${loggedIn ? 'Logged In' : 'Logged Out'}</p>
        <ul>
            <li><a href="/login">Login</a></li>
            <li><a href="/logout">Logout</a></li>
            <li><a href="/profile">Profile</a></li>
            <li><a href="/call-api">Call Sprint Boot /secure-data</a></li>
        </ul>
    `);
}

// 7) Routes

// Home route
app.get('/', homePage);

// Login: request OIDC scopes and API audience (to obtain access token for calling protected Spring API)
app.get('/login', passport.authenticate('auth0', {
    scope: 'openid email profile',
    // IMPORTANT: Set audience to your Auth0 API Identifier (e.g., https://myapi.example.com)
    // This ensures the returned access token can be validated by protected Spring API.
    // If you set this here, Passport adds it to the authorize request.
    // Alternatively, configure ths in your Auth0 Application settings.
    audience: process.env.AUTH0_API_AUDIENCE
}));

// Callback:  Auth0 redirects here after successful login
app.get('/callback', passport.authenticate('auth0', {
    failureRedirect: '/'
}), (req, res) => {
    // Successful authentication, redirect to profile
    console.log('User after login:', req.user);
    res.redirect('/profile');
});

// Logout: end lcoal session and redirect to Auth0 logout (optional)
app.get('/logout', (req, res) => {
    req.logout(() => {
        const returnTo = encodeURIComponent('http://localhost:' + PORT + '/');
        const logoutURL = `https://${AUTH0_DOMAIN}/v2/logout`;
        logoutURL.searchParams.append('client_id', AUTH0_CLIENT_ID);
        logoutURL.searchParams.append('returnTo', returnTo);
        res.redirect(logoutURL.toString());
    }

    );
    res.redirect('/');
});  

// Profile (Protected)
app.get('/profile', ensureLoggedIn, (req, res) => {
    const { profile, idToken, accessToken } = req.user || {};
    res.send(`
        <h1>Profile</h1>
        <pre>${JSON.stringify(profile, null, 2)}</pre>
        <h3>Tokens</h3>
        <p>ID Token (JWT): ${idToken ? idToken.slice(0, 40) + '...' : 'none'}</p>
        <p>Access Token: ${accessToken ? accessToken.slice(0, 40) + '...' : 'none'}</p>
        <p><a href="/call-api">Call Protected Spring API</a></p>
        <p><a href="/">Home</a></p>
    `);
});

// Call Spring Boot protected API (requires access token)
app.get('/call-api', ensureLoggedIn, async (req, res) => {
    const accessToken = req.user && req.user.accessToken;
    if (!accessToken) {
        return res.status(401).send('No access token. Please log in again.');
    }

    // Adjust endpoint path to match you Spring Boot controller
    const url = `${API_BASE_URL || 'http://localhost:8080'}/secure-data`;
    
    try {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const text = await response.text();
        res.send(`
            <h2>Spring Boot API Response</h2>
            <pre>${text}</pre>
            <p>Status: ${response.status}</p>
            <p><a href="/">Home</a></p>
        `);
        
    } catch (error) {
        console.error('Error calling protected API:', error);
        res.status(500).send(`
            <h2>Error Calling Protected API</h2>
            <p>${error.message}</p>
            <p><a href="/">Home</a></p>
        `);   
    }
});

// 8. Start the server
app.listen(PORT, () => {
    console.log(`Node.js client running on http://localhost:${PORT}`);
    console.log('Visit /login to start the Auth0 flow.');
});

