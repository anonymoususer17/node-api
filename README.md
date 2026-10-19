# Hello API

Run the local server:

```sh
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
