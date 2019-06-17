#!/usr/bin/env node

const fs = require("fs");
const acorn = require("acorn");
const escodegen = require("escodegen");
const path = require("path");

// Thanks to this: http://sevinf.github.io/blog/2012/09/29/esprima-tutorial/
async function traverse(node, func) {
    await func(node);//1
    for (var key in node) { //2
        if (node.hasOwnProperty(key)) { //3
            var child = node[key];
            if (typeof child === 'object' && child !== null) { //4
                
                if (Array.isArray(child)) {
                    for (let node of child) {
                        await traverse(node, func);
                    }
                } else {
                    await traverse(child, func); //6
                }
            }
        }
    }
}

const es6_Transform = async function (file) {
    const text = await fs.promises.readFile(file);
    const tree = acorn.parse(text);

    await traverse(tree, async node => {
        if (node.type === "ExpressionStatement"
            && node.expression.type === "AssignmentExpression"
            && node.expression.left.type === "MemberExpression"
            && node.expression.left.object.type === "Identifier"
            && node.expression.left.object.name === "exports") {
            const exportName = node.expression.right.name;

            node.type = "ExportNamedDeclaration";
            delete node.expression;
            delete node.start;
            delete node.end;
            node.declaration = null;
            node.specifiers = [{
                type: "ExportSpecifier",
                local: {
                    type: "Identifier",
                    name: exportName
                },
                exported: {
                    type: "Identifier",
                    name: exportName
                }
            }];
            node.source = null;
        }

        if (node.type === "ExpressionStatement"
            && node.expression.type === "AssignmentExpression"
            && node.expression.operator === "="
            && node.expression.left.type === "MemberExpression"
            && node.expression.left.object.type === "Identifier"
            && node.expression.left.object.name === "module"
            && node.expression.left.property.name === "exports") {
            const exportingExpression = node.expression.right;
            delete exportingExpression.start;
            delete exportingExpression.end;
            node.type = "ExportDefaultDeclaration";
            delete node.start;
            delete node.end;
            delete node.expression;
            node.declaration = exportingExpression;
        }

        if (node.type === "VariableDeclaration"
            && node.declarations[0].type === "VariableDeclarator"
            && node.declarations[0].init.type === "CallExpression"
            && node.declarations[0].init.callee.type === "Identifier"
            && node.declarations[0].init.callee.name === "require"
            && node.declarations[0].init.arguments[0].type === "Literal") {
            // Hack it into an import
            const requireIdentifier = node.declarations[0].id.name;
            const requireSource = node.declarations[0].init.arguments[0].value;
            const requireSourceRaw = node.declarations[0].init.arguments[0].raw;
            node.type = "ImportDeclaration";
            delete node.declarations;
            delete node.kind;
            delete node.start;
            delete node.end;

            node.specifiers = [{
                type: "ImportNamespaceSpecifier",
                local: {
                    type: "Identifier",
                    name: requireIdentifier
                }
            }];
            node.source = {
                type: "Literal",
                value: requireSource,
                raw: requireSourceRaw
            };
        }
    });
    
    tree.sourceType = "module";
    // console.log("source", JSON.stringify(tree, null,2));

    return escodegen.generate(tree);
}

const parseSource = async function (file) {
    const text = await fs.promises.readFile(file);
    const tree = acorn.parse(text, {
        sourceType: (file.endsWith(".mjs") ? "module" : "script")
    });
    return JSON.stringify(tree, null, 2);
};

const passSource = async function (file) {
    const text = await fs.promises.readFile(file);
    const tree = acorn.parse(text, {
        sourceType: (file.endsWith(".mjs") ? "module" : "script")
    });
    return escodegen.generate(tree);
};

const write = async function (file) {
    const transformedSource = await es6_Transform(file);
    const parts = path.parse(file);
    let {dir, root, base, name, ext} = parts;
    ext = ".mjs";
    const targetFile =
          root
          + dir
          + ((dir.length === 0) ? name : path.sep + name)
          + ext;
    await fs.promises.writeFile(targetFile, transformedSource, "utf8");
    return targetFile + "\n";
}

if (require.main === module) {
    const inputFileArg = process.argv[3];
    let promise;
    switch(process.argv[2]) {
    case "parse":
        promise = parseSource(inputFileArg)
        break;
    case "hack":
        promise = es6_Transform(inputFileArg);
        break;
    case "pass":
        promise = passSource(inputFileArg);
        break;
    case "write":
        promise = write(inputFileArg);
        break;
    default:
        promise = Promise.resolve(`common2es6 -- transform a commonjs file into an ES6 file

Use it like this:

  common2es6 parse <filename>   -- outputs the AST of the source file, ES6 or CommonJS
  common2es6 pass <filename>    -- parses and then gens the source file
  common2es6 hack <filename>    -- parses and rewrites the CommonJS source file to ES6
  common2es6 write <filename>   -- parses CommonJS, rewrites and writes the resulting ES6

The latter generates .mjs files from js files so is ideal in an NPM prepare script.
`);
        break;
    }
    promise
        .then(out => process.stdout.write(out))
        .catch(e => console.log(e));

}

// End
