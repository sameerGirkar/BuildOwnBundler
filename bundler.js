const fs = require("fs");
const path = require("path");
const babylon = require("babylon"); //JS parser which parse the file in form of JSON object as (AST explorer)
const traverse = require("babel-traverse").default; //This is use to traverse the tree greated by babylon which is AST tree
const babel = require("babel-core");

let ID = 0;

function CreateAsset(fileName) {
  const content = fs.readFileSync(fileName, "utf-8");
  const ast = babylon.parse(content, {
    sourceType: "module",
  });

  const dependencies = [];
  // This will traverse the AST tree and get the node of given type here we are passing the node type as ImportDeclaration
  traverse(ast, {
    ImportDeclaration: ({ node }) => {
      dependencies.push(node.source.value); //node.source.value is a relative path of the dependency
    },
  });
  const id = ID++;
  //   This will convert the file using commonJs format
  const { code } = babel.transformFromAst(ast, null, {
    presets: ["env"],
  });
  return {
    id,
    fileName,
    dependencies,
    code,
  };
}

function CreateGraph(entry) {
  const mainAsset = CreateAsset(entry);
  const queue = [mainAsset];

  for (const asset of queue) {
    const dirname = path.dirname(asset.fileName);
    asset.mapping = {};
    asset.dependencies.forEach((relativePath) => {
      const absolutePath = path.join(dirname, relativePath);
      const child = CreateAsset(absolutePath);
      asset.mapping[relativePath] = child.id;
      queue.push(child);
    });
  }
  return queue;
}

const graph = CreateGraph("example/entry.js");
// console.log(graph);
/**
[ { id: 0,
    fileName: 'example/entry.js',
    dependencies: [ './message.js' ],
    code:
     '"use strict";\n\nvar _message = require("./message.js");\n\nvar _message2 = _interopRequireDefault(_message);\n\nfunction _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }\n\nconsole.log(_message2.default);',
    mapping: { './message.js': 1 } },
  { id: 1,
    fileName: 'example/message.js',
    dependencies: [ './name.js' ],
    code:
     '"use strict";\n\nvar _name = require("./name.js");\n\nvar _name2 = _interopRequireDefault(_name);\n\nfunction _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }\n\nconsole.log(_name2.default);',
    mapping: { './name.js': 2 } },
  { id: 2,
    fileName: 'example/name.js',
    dependencies: [],
    code:
     '"use strict";\n\nObject.defineProperty(exports, "__esModule", {\n  value: true\n});\nvar name = exports.name = "Hell this is name";',
    mapping: {} } ]
 */

function createBundle(graph) {
  let modules = "";
  graph.forEach((mod) => {
    modules += `
            '${mod.id}' : [
                function(require, module, exports){
                    ${mod.code}
                },
                ${JSON.stringify(mod.mapping)}
            ],
        `;
  });
  return `(function (modules){
        
        function require(id){
            const [fun, mapping] = modules[id];
            const module = { exports: {} };
            function localRequire(relativePath) {
                return require(mapping[relativePath]);
            }
            fun(localRequire, module, module.exports);
            return module.exports;
        }
        require(0);
    })({${modules}})`;
}

const bundle = createBundle(graph);
console.log(bundle);

/**
 * 
 * 
 * 
 * (function (modules){

        function require(id){
            const [fun, mapping] = modules[id];
            const module = { exports: {} };
            function localRequire(relativePath) {
                return require(mapping[relativePath]);
            }
            fun(localRequire, module, module.exports);
            return module.exports;
        }
        require(0);
    })({
            '0' : [
                function(require, module, exports){
                    "use strict";

var _message = require("./message.js");

var _message2 = _interopRequireDefault(_message);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

console.log(_message2.default);
                },
                {"./message.js":1}
            ],

            '1' : [
                function(require, module, exports){
                    "use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _name = require("./name.js");

var _name2 = _interopRequireDefault(_name);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = "Hello " + _name2.default;
                },
                {"./name.js":2}
            ],

            '2' : [
                function(require, module, exports){
                    "use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = " Bundler !!!";
                },
                {}
            ],
        })
*/
