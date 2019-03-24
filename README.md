# Caching
This is a cache library build around the nodeJS File System and based on [PSR-16](https://www.php-fig.org/psr/psr-16/), only in JavaScript.

## How to use it

```js
const Cache = require('js-file-cache');
var cache   = new Cache(__dirname+'/my-cache-directory/');
```

### Caching
Inform an unique identifier for the data you desire to cache. Optionally you may inform its time to live, otherwise the cached data will never expire.
```js
cache.set('somethingCostlyToAcquire', value, 60 * 60 * 24 * 1000);
```

### Caching multiple values at once

```js
cache.setMultiple(
{
    foo           : 'bar',
    hello         : world,
    myObject      : myObject
}, 60 * 60 * 24 * 1000);
```

### Retrieving
Use ::get to retrieve your data, if the data doesn't exist in cache or has expired then a fallback value will be returned, which defaults to null if not informed.

```js
var fallback = 'nothing here';
cache.get('somethingCostlyToAcquire', fallback).then((data) =>
{
    console.log(data);
});
```

### Retrieving multiple values at once
```js
cache.getMultiple(['object1', 'value1', 'anotherObject'], fallback).then((data) =>
{
    console.log(data);
});
```

## How to install
Use npm

```json
// package.json
"dependencies": {
    "js-file-cache": "git+https://git@github.com/adinan-cenci/js-file-cache.git"
}
```
