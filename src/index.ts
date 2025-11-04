import createApp from './app';

const app = createApp();
const port = process.env.PORT ?? 3000;

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${port}`);
});
