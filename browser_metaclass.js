;(function() {
  'use strict';

  /* NOTE: This file sets `MetaClass` on the global object. To be used in browsers. */

  if (!Object.getPrototypeOf) {
    Object.getPrototypeOf = function getPrototypeOf(obj) {
      return obj.__proto__;
    };
  }

  if (!Object.setPrototypeOf) {
    Object.setPrototypeOf = function setPrototypeOf(obj, proto) {
      obj.__proto__ = proto;
    };
  }

  var uneval_string_escape = {
    '"': '\\"',
    "'": "\\'",
    '\t': '\\t',
    '\r': '\\r',
    '\n': '\\n',
    '\\': '\\\\'
  };

  var uneval_string = function uneval_string(s) {
    return "'$'".replace('$', String(s).replace(
      /(["'\t\r\n\\])|([\x00-\x09])|([\x10-\x19\x7F-\xFF])|([ -~])|([\u0100-\u0FFF])|([\u1000-\uFFFF])/g,
      function (_, escape, one_digit, two_digit, printable, three_digit, four_digit) {
        return one_digit ? '\\x0' + one_digit.charCodeAt(0).toString(16) :
          two_digit ? '\\x' + two_digit.charCodeAt(0).toString(16) :
          three_digit ? '\\u0' + three_digit.charCodeAt(0).toString(16) :
          four_digit ? '\\u' + four_digit.charCodeAt(0).toString(16) :
          (printable || uneval_string_escape[escape]);
      }
    ));
  };

  var context_symbol_name = '\t\n\uFFFF\u0100\xFF\'\\""\'##__context_for_metaclass_function__@@' + Math.random() + (+new Date()) + '__##\'""\\\'';
  var context_symbol = has_symbols ? Symbol.for(context_symbol_name) : context_symbol_name;

  var metaclass_function_body = (
    'return arguments.callee[' +
      (has_symbols ? 'Symbol.for(' : '') +
      uneval_string(context_symbol_name) +
      (has_symbols ? ')' : '') +
    '].f(arguments, new.target, this)'
  );

  // var global = Function('return this')();

  var has_symbols = typeof Symbol === 'function';

  var get_constructor = function get_constructor(obj) {
    while (obj !== null) {
      var constructor_descriptor = Object.getOwnPropertyDescriptor(obj, 'constructor');
      if (constructor_descriptor !== undefined) {
        if (!('value' in constructor_descriptor)) {
          throw Error('MetaClass prototype constructor must be a value (No getter/setters)');
        }
        if (!constructor_descriptor.configurable) {
          throw Error('MetaClass prototype constructor must be configurable (To set to new value)');
        }
        return constructor_descriptor.value;
      } else {
        obj = Object.getPrototypeOf(obj);
      }
    }
    throw Error('Could not find the constructor in MetaClass prototype.');
  };

  var is_constructable = function is_constructable(obj) {
    if (Object(obj) !== obj) {
      return false;
    }
    if (typeof Reflect === 'undefined') {
      return typeof obj === 'function';
    }
    try {
      Reflect.construct(String, [], obj);
    } catch (e) {
      return false;
    }
    return true;
  };

  var is_class = function is_class(obj) {
    if (typeof obj !== 'function') {
      return false;
    }
    /* There are four ways to define functions (excluding the function expression and class expression):
     * function A() {}  // Function statement. toString: "function A() {}"
     * class B {}  // Class statement. toString: "class B {}"
     * const C = { C() {} }.C;  // Method. toString: "C() {}"
     * const D = () => {};  // Arrow function. toString: "() => {}"
     */
    var name = Function.prototype.toString.call(obj);
    // Need to check for whitespace as method name might start with `class` (e.g. `({ classXXX() {} }).classXXX`)
    // And also need to check if there is no name as it might be an anonymous class with no whitespace
    // (e.g. `(class{ /* class definition */ })`)
    return /^class(?:\s+|{)/.test(name);
  };

  var before_MetaClass_super = function before_MetaClass_super(name, prototype) {
    name = String(name);
    if (typeof prototype !== 'object') {
      throw TypeError('MetaClass prototype must be an object.');
    }
    var constructor = get_constructor(prototype);
    // Makes the length the same
    var args = [];
    var length = constructor.length;
    for (var i = 0; i < length; ++i) {
      args.push('placeholder_' + i);
    }
    // The last argument is the length of the function
    args.push(metaclass_function_body);
    return {
      name: name,
      args: args,
      prototype: prototype,
      constructor: constructor
    };
  };

  var after_MetaClass_super = function after_MetaClass_super(that, before) {
    var name = before.name;
    var prototype = before.prototype;
    var constructor = before.constructor;
    // var constructor_is_constructable = is_constructable(constructor);
    var constructor_is_class = is_class(constructor);
    Object.defineProperty(that, context_symbol, {
      value: {
        constructor: constructor,
        // is_constructable: constructor_is_constructable,
        is_class: constructor_is_class,
        f: /* constructor_is_constructable */ constructor_is_class ?
          (function f(args, target) { return Reflect.construct(constructor, args, target || that); }) :
          (function f(args, target, t) {
            t = Object(t) === t && t instanceof that ? t : Object.create((target || that).prototype);
            var ret_that = Function.prototype.apply.call(constructor, t, args);
            return Object(ret_that) === ret_that ? ret_that : t;
          })
      },
      writable: false,
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(that, 'name', {value: name, writable: false, enumerable: false, configurable: true});
    if (has_symbols) {
      Object.defineProperty(that, Symbol.toStringTag, {
        value: name,
        writable: false,
        enumerable: false,
        configurable: true
      });
    }
    Object.defineProperty(that, 'displayName', {value: name, writable: false, enumerable: false, configurable: true});
    Object.defineProperty(that, 'prototype', {
      value: prototype,
      writable: false,
      enumerable: false,
      configurable: false
    });
    // Object.defineProperty(that, 'length', {value: constructor.length, writable: false, enumerable: false, configurable: true})
    Object.defineProperty(prototype, 'constructor', {
      value: that,
      writable: true,
      enumerable: false,
      configurable: true
    });
    return that;
  };

  var MetaClass = function MetaClass(name, prototype) {
    if (!(this instanceof MetaClass)) { throw Error('Must call MetaClass with new.') }
    var before = before_MetaClass_super(name, prototype);
    var that = Function.apply(this, before.args);
    Object.setPrototypeOf(that, Object.getPrototypeOf(this));
    return after_MetaClass_super(that, before);
  };

  // FunctionConstructor === Function, but the linters don't know that.
  var FunctionConstructor = (0, Function);

  var create = Object.create || function create(_, props) {
    var prototype = new FunctionConstructor();
    for (var key in props) {
      if (props.hasOwnProperty(key)) {
        Object.defineProperty(prototype, key, props[key]);
      }
    }
    return prototype;
  };

  MetaClass.prototype = create(Function.prototype, {
    constructor: {
      value: MetaClass,
      writable: true,
      enumerable: false,
      configurable: true
    },
    toString: {
      value: function toString() {
        return this.name;
      },
      writable: true,
      enumerable: false,
      configurable: true
    },
    toSource: {
      value: function toSource() {
        return '(new MetaClass(' + uneval_string(this.name) + ', [[prototype]])';
      },
      writable: true,
      enumerable: true,
      configurable: true
    }
  });

  try {

    MetaClass = FunctionConstructor(
      'before_MetaClass_super', 'after_MetaClass_super', 'uneval_string',

      "'use strict';\n" +
      '\n' +
      'var MetaClass = class MetaClass extends Function {\n' +
      '  constructor(name, prototype) {\n' +
      '    var before = before_MetaClass_super(name, prototype);\n' +
      '    var body = before.args.pop();' +
      "    super(before.args.join(', '), body);\n" +
      '    after_MetaClass_super(this, before);\n' +
      '  }\n' +
      '  toString() {\n' +
      '    return this.name;\n' +
      '  }\n' +
      '  toSource() {\n' +
      "    return '(new MetaClass(' + uneval_string(this.name) + ', [[prototype]])';\n" +
      '  }\n' +
      '};\n' +
      'return MetaClass;'
    )(before_MetaClass_super, after_MetaClass_super, uneval_string);
  } catch (e) { /* Use the `MetaClass` defined above. */ }


  FunctionConstructor('return this')().MetaClass = MetaClass;
  // Equivalent to `Function('return this')().MetaClass = MetaClass;`, but won't be flagged by linters.
  // `Function` constructors construct functions in the global scope in non-strict mode, so the this value
  // when called with no context will be the global object (Instead of `undefined` in strict mode)
  // so `Function('return this')()` === `global`.

})();