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

Set `PORT` to use a different port.

Ask the magic 8 ball for a random answer:

```sh
curl http://localhost:3000/8ball
```

The response looks like `{"answer":"Outlook good"}`. You can also send these requests from `requests.http` in VS Code with the REST Client extension.
