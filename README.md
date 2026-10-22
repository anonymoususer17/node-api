# Hello API

Install dependencies and run the local server:

```sh
npm install
npm start
```

Then request `http://localhost:3000/hello` in a browser or run:

```sh
curl http://localhost:3000/hello
```

The response is `Hello, world!`.

To draw six distinct numbers from 1 through 40:

```sh
curl http://localhost:3000/loto
```

The response looks like `{"numbers":[1,7,12,19,32,40]}`. Each request makes a new draw using Node's cryptographic random number generator, then sorts the numbers in ascending order.

To draw multiple sets, add a count from 1 to 100 to the URL. For example, `curl http://localhost:3000/loto/10` returns an array of ten draws, each containing six distinct numbers from 1 through 40. Counts outside that range return HTTP 400.

For a readable response with one draw per line, use `curl http://localhost:3000/loto/10?format=text`. The REST Client example uses this format because the extension expands JSON arrays across multiple lines.

Set `PORT` to use a different port.

Ask the magic 8 ball for a random answer:

```sh
curl http://localhost:3000/8ball
```

The response looks like `{"answer":"Outlook good"}`. You can also send these requests from `requests.http` in VS Code with the REST Client extension.
