'use strict';

const uneval_string_escape = {
  '"': '\\"',
  "'": "\\'",
  '\t': '\\t',
  '\r': '\\r',
  '\n': '\\n',
  '\\': '\\\\'
};

/**
 * Returns a string so that when it is evaluated, it will be the original string.
 *
 * (It escapes characters to equivalent hex or escape sequence representations if they
 *  are not printable)
 *
 * @param s {string} The string to uneval
 * @returns {string} eval(return) === s
 */
const uneval_string = s => "'$'".replace('$', String(s).replace(
  /(["'\t\r\n\\])|([\x00-\x09])|([\x10-\x19\x7F-\xFF])|([ -~])|([\u0100-\u0FFF])|([\u1000-\uFFFF])/g,
  (_, escape, one_digit, two_digit, printable, three_digit, four_digit) =>
    one_digit ? '\\x0' + one_digit.charCodeAt(0).toString(16) :
    two_digit ? '\\x' + two_digit.charCodeAt(0).toString(16) :
    three_digit ? '\\u0' + three_digit.charCodeAt(0).toString(16) :
    four_digit ? '\\u' + four_digit.charCodeAt(0).toString(16) :
    (printable || uneval_string_escape[escape])
));


// Name of the symbol that holds the internal function to be called when a MetaClass object is called.
const context_symbol_name = '\t\n\uFFFF\u0100\xFF\'\\""\'##__context_for_metaclass_function__@@' + Math.random() + (+new Date()) + '__##\'""\\\'';
const context_symbol = Symbol.for(context_symbol_name);

// The body of the MetaClass function. `arguments.callee` will be the MetaClass object,
// and it calls `arguments.callee[context_symbol]`
const metaclass_function_body = (
  'return arguments.callee[Symbol.for(' + uneval_string(context_symbol_name) + ')].f(arguments, new.target, this)'
);

// const global = Function('return this')();

/**
 * Gets an objects constructor by going up it's prototype chain.
 *
 * @param obj The object to check the prototype chain of.
 * @throws {Error} If no constructor found, the constructor has a getter, or if it is not configurable.
 * @returns {function} The constructor.
 */
const get_constructor = obj => {
  while (obj !== null) {
    const constructor_descriptor = Object.getOwnPropertyDescriptor(obj, 'constructor');
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

/**
 * Returns true if an object has an internal [[Construct]] method.
 *
 * @param obj {function} The object to check for.
 * @returns {boolean}
 */
const is_constructable = obj => {
  if (Object(obj) !== obj) {
    return false;
  }
  try {
    Reflect.construct(String, [], obj);
  } catch (e) {
    return false;
  }
  return true;
};

/**
 * Returns true if an object is a class.
 *
 * @param obj {function} the object to check.
 * @returns {boolean}
 */
const is_class = obj => {
  if (typeof obj !== 'function') {
    return false;
  }
  /* There are three ways to define functions (excluding the function expression and class expression):
   * function A() {}  // Function statement. toString: "function A() {}"
   * class B {}  // Class statement. toString: "class B {}"
   * const C = { C() {} }.C;  // Method. toString: "C() {}"
   * const D = () => {};  // Arrow function expression. toString: "() => {}"
   */
  const name = Function.prototype.toString.call(obj);
  // Need to check for whitespace as method name might start with `class` (e.g. `({ classXXX() {} }).classXXX`)
  // And also need to check if there is no name as it might be an anonymous class with no whitespace
  // (e.g. `(class{ /* class definition */ })`)
  return /^class(?:\s+|{)/.test(name);
};

// The MetaClass class.
// Call with the name of the class and the prototype of instances of the class.
module.exports = class MetaClass extends Function {
  /**
   * @param name {string} Name of the class.
   * @param prototype {Object} prototype of the class.
   */
  constructor(name, prototype) {
    name = String(name);
    if (typeof prototype !== 'object') {
      throw TypeError('MetaClass prototype must be an object.');
    }
    const constructor = get_constructor(prototype);
    // Makes the length the same
    const args = [];
    const length = constructor.length;
    for (let i = 0; i < length; ++i) {
      args.push('placeholder_' + i);
    }
    // The last argument is the length of the function
    args.push(metaclass_function_body);
    void({
      [name]: super(...args)
    });
    // const constructor_is_constructable = is_constructable(constructor);
    const that = this;
    const constructor_is_class = is_class(constructor);
    Object.defineProperty(this, context_symbol, {
      value: {
        constructor: constructor,
        // is_constructable: constructor_is_constructable,
        is_class: constructor_is_class,
        f: /* constructor_is_constructable */ constructor_is_class ?
          ((args, target) => Reflect.construct(constructor, args, target || that)) :
          ((args, target, t) => {
            t = Object(t) === t && t instanceof that ? t : Object.create((target || that).prototype);
            const ret_that = Function.prototype.apply.call(constructor, t, args);
            return Object(ret_that) === ret_that ? ret_that : t;
          })
      },
      writable: false,
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(this, 'name', {value: name, writable: false, enumerable: false, configurable: true});
    Object.defineProperty(this, Symbol.toStringTag, {value: name, writable: false, enumerable: false, configurable: true});
    Object.defineProperty(this, 'displayName', {value: name, writable: false, enumerable: false, configurable: true});
    Object.defineProperty(this, 'prototype', {value: prototype, writable: false, enumerable: false, configurable: false});
    // Object.defineProperty(this, 'length', {value: constructor.length, writable: false, enumerable: false, configurable: true})
    Object.defineProperty(prototype, 'constructor', { value: this, writable: true, enumerable: false, configurable: true });
  }
  // No longer need to forward direct `call`s.
  /*call(this_arg, ...args) {
    return this.apply(this_arg, args);
  }
  apply(this_arg, args) {
    if (/*!this[context_symbol].is_constructable || * / !this[context_symbol].is_class) {
      return Function.prototype.apply.call(this[context_symbol].constructor, this_arg, args);
    }
    // TODO: Check that this is correct
    // But this is only called if a traditional function class inherits from a
    const constructed = this[context_symbol].f(args, (this_arg && this_arg.constructor) || undefined);
    Object.defineProperties(this_arg, Object.getOwnPropertyDescriptors(constructed));
    return this_arg;
  }*/
  toString() {
    return this.name;
  }
  toSource() {
    return '(new MetaClass(' + uneval_string(this.name) + ', [[prototype]])';
  }
};
