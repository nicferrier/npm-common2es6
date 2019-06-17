# Convert simple CommonJS modules to ES6

This helps convert simple use cases of NodeJS style (also called
CommonJS) modules usage to ES6 style modules.

It is published in June 2019. It is likely to have a short shelf life.


## Background

The Javascript world changes fast and often in multiple directions.

NodeJS and browsers are very different targets and often things that
happen to one or the other don't impact the other world.

But right now we've got a crappy situation with many web packages
increasingly using NPM to package... but the official module system
for the web being basically incompatible with node.

The Node folks are working hard to support the modules system invented
for the web, which I will call *ES6 modules* here.

But the two are substantially different and it's a struggle.

In the mean time we have got a struggle if we want to use one code
base on Node and on the web.

There are tools like Babel and Browserify... but these have become
increasingly crufty and complicated.

I wanted a tool to do just a simple thing: convert a module, in
respect of it's import code, from CommonJS to ES6.

The rest I will simply write in ES6 style.

## So what does it do?

Well, here we go:

```
$ npm install -g @nicferrier/common2es6
$ common2es6
common2es6 -- transform a commonjs file into an ES6 file

Use it like this:

  common2es6 parse <filename>   -- outputs the AST of the source file, ES6 or CommonJS
  common2es6 pass <filename>    -- parses and then gens the source file
  common2es6 hack <filename>    -- parses and rewrites the CommonJS source file to ES6
  common2es6 write <filename>   -- parses CommonJS, rewrites and writes the resulting ES6

The latter generates .mjs files from js files so is ideal in an NPM prepare script.
```

and you can do this to see a module converted to ES6 style:

```
$ cat <<EOF > test.js
function myFunc() {
  return "this is a test!";
}

module.exports = myFunc;
EOF
$ common2es6 hack test.js
function myFunc() {
    return 'this is a test!';
}
export default myFunc;
```

or you can simply generate the ES6 file:

```
$ common2es6 write test.js
test.mjs
$ cat test.mjs
function myFunc() {
    return 'this is a test!';
}
export default myFunc;
```

You can also generate multiple ES6 files at the same time:

```
$ common2es6 write test.js test2.js
test.mjs
test2.mjs
```


The other commands might be useful because this is a very early thing
and probably full of bugs.

## What transforms does it do?

It's nothing like babel or browserify.

### it notices module.exports and converts that to a default export

```javascript
function myFunc() {
  return "this is a test!";
}

module.exports = myFunc;
```

becomes:

```javascript
function myFunc() {
  return "this is a test!";
}

export default myFunc;
```

### it notices exports.x and converts that to a named export

```javascript
function myFunc() {
  return "this is a test!";
}

function otherFunc() {
  return "this is NOT a test!";
}

exports.myFunc = myFunc;
exports.otherFunc = otherFunc;
```

becomes:

```javascript
function myFunc() {
  return "this is a test!";
}

function otherFunc() {
  return "this is NOT a test!";
}

export {myFunc};
export {otherFunc};
```

### it notices requires and converts them to imports

```javascript
const testModule = require("./test.js");
```

becomes:

```javascript
import * as testModule from './test.js';
```

which is pretty much the same thing.


*That's it!*


## How should I use it?

What I'm doing is using it in a `prepare` script to generate mjs files 



## FAQ

*what is an mjs file?*

It's a NodeJs version of an ES6 modules. You can use these with modern
Nodes (say, from 10.0.0 on) by doing this:

```
$ node --experimental-modules test-module.mjs
```

*How does this work?*

It uses `acorn`, a javascript parser, to read in js and then hack it
in specific ways at the AST level and then regenerate the source code
from the new AST.

