# Hello API

## Arithmetic solver

In `requests.http`, click **Send Request** above:

```http
GET {{baseUrl}}/solve?numbers=3,3,8,8&target=24
```

Response:

```text
Make 24 using 3, 3, 8, 8.
Use each number once. Allowed: + - * / and parentheses.

(8 / (3 - (8 / 3))) = 24

1. 8 / 3 = 8/3
2. 3 - (8/3) = 1/3
3. 8 / (1/3) = 24
```

Change `numbers` and `target` to try another puzzle. Every supplied number must
be used exactly once. Fractions and negative intermediate results are allowed.
Concatenation, powers, and factorials are not allowed. If there is no exact
solution under these rules, the API returns the closest reachable value and its
distance from the target. Equal-distance ties return the first result found.

| Parameter | Default | Accepted values |
| --- | --- | --- |
| `numbers` | `3,3,8,8` | 2–5 comma-separated integers, each from 1 to 100 |
| `target` | `24` | Integer from -1000000 to 1000000 |
| `format` | `text` | `text` or `json` |

JSON includes `exact`, `expression`, `result`, `distance`, and calculation `steps`.
Results and step operands are strings so fractions stay exact. Invalid, repeated,
and unknown parameters return HTTP 400 with a JSON error.

The solver uses subset dynamic programming and exact BigInt fractions. It
considers every binary arithmetic expression permitted by the rules, retaining
one expression per distinct value and subset. It stops when it finds an exact
answer; otherwise it completes the search to find the closest result. The
five-number limit bounds the search. No external services or API keys are used.

Run `npm test` to check expression arithmetic, number usage, closest answers
against an independent search, input validation, and HTTP endpoints.

## Game of Life

`GET /universe?seed=hello-world` runs two Game of Life grids with one central cell
flipped in the second grid. It returns every generation as JSON, along with
population and difference counts. Add `&format=svg` for the original animated
three-panel view. Requests for both formats are in `requests.http`.

| Parameter | Default | Accepted values |
| --- | --- | --- |
| `seed` | Random, returned in response | 1–64 ASCII letters, digits, `_`, `-` |
| `width` | 40 | Integer 12–64 |
| `height` | 24 | Integer 12–48 |
| `steps` | 80 | Integer 1–120 |
| `density` | 35 | Integer 0–100; initial live-cell probability in percent |
| `format` | `json` | `json` or `svg` |

All cells update simultaneously. A dead cell is born with three living neighbors;
a living cell survives with two or three. Opposite edges connect. Grids are arrays
of binary row strings, with coordinates starting at zero in the top-left.
There are `steps + 1` frames including the starting state. The intervention toggles
the cell at `(floor(width / 2), floor(height / 2))`.

Identical seeds and parameters reproduce the same experiment. The response has
replay links, the simulation version, the peak and final difference counts, the
number of distinct positions that ever differed, and the first generation when
the worlds matched again (`null` if they never match during the run).

The SVG advances every 120 ms, holds the final state for two seconds, and loops.
Its chart and summary describe the entire run. It needs a viewer that supports
SVG SMIL animation; a static viewer shows generation zero.
Unknown, repeated, and invalid parameters return HTTP 400 with a JSON error.

## Existing endpoints

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
