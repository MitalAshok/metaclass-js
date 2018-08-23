metaclass
=========

A class where its instances are classes

## Usage

Exports one thing: The `MetaClass` class.

`MetaClass` takes two arguments: `name` (a `String` that is the name of the class) and `prototype` (Which is the prototype of the returned class).

If you inherit from `MetaClass`, the metaclasses prototype will act like static properties / methods for the created classes.

Most of the time you will want to create a subclass with more limited parameters (And create the prototype in the constructor of the metaclass).

```javascript
/* Importing the module is done like this.
 
// With modules
import MetaClass from 'metaclass';
 
// In node
const MetaClass = require('metaclass');
 
// In browser
// (Note: Use browser_metaclass.js as it will work and
//  trying to use Babel on metaclass.js will
//  lead to subtle bugs)
<script src="/js/browser_metaclass.js"></script>
const MetaClass = window.MetaClass;
*/
 
const create_property = index => ({
  get: function get_index() {
    return this[index];
  },
  set: function set_index(value) {
    this[index] = value;
  },
  enumerable: true,
  configurable: true
});
 
/* For example, `NamedArray` 
 * returns a class that inherits from
 * `Array` and also has named
 * getters and setters for indices.
 */
class NamedArray extends MetaClass {
  constructor(name, index_names) {
    const prototype = Object.create(Array.prototype);
    if (typeof index_names === 'string' || index_names instanceof String) {
      index_names = String(index_names).split(/ /g);
    } else {
      index_names = Array.from(index_names);
    }
    for (let i = 0; i < index_names.length; i++) {
      Object.defineProperty(prototype, index_names[i], create_property(i));
    }
    delete prototype.constructor;
    super(name, prototype);
    this._index_names = index_names;
  }
  from_object(obj) {
    const arr = new this();
    for (const name of this._index_names) {
      arr[name] = obj[name];
    }
    return arr;
  }
}
 
const Point = new NamedArray('Point', 'x y');
 
class Vector extends new NamedArray('Vector', 'i j') {
  magnitude() {
    return Math.sqrt(this.i * this.i + this.j * this.j);
  }
  dot(other) {
    return this.i * other[0] + this.j * other[1];
  }
}
 
// Used like this
const origin = new Point(0, 0);
const p = new Point(2, 3);
console.log(origin.x, origin[0], p.x, p[0]);
//          0         0          2    2
console.log(origin.y, origin[1], p.y, p[1]);
//          0         0          3    3
 
const vec = new Vector(3, 4);
const vec2 = Vector.from_object({
  i: 5,
  j: 6
});
console.log(vec.i, vec.magnitude());
//          3      5
console.log(vec2[0], vec.dot(vec2));
//          5        39
 
console.log(origin instanceof Point);  // true
console.log(Point instanceof NamedArray);  // true
```

## Theory

JavaScript classes are just functions. All functions are instances of `Function`. `Function` is a class that has a constructor.

`MetaClass` extends `Function`. When extending an object, you have to call `super`, which invokes the constructor of the base class. The [`Function` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function) takes an argument list then the body of the function as a string (Kind of like `eval`), except it is run in the global scope. This means that it is hard to access a closure object (Like the original `constructor` function to initialise the new class). To solve this, a reference to the function being called is obtained using [`arguments.callee`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/arguments/callee), where the original constructor is in a property. Since `MetaClass` objects are also instances of `Function`, they can be called and be constructed with `new`.

`MetaClass` instances implement `[[Call]]`, so their `typeof` is defined by the standards to be `function`.

All `MetaClass` objects have the same function body. The only difference is the properties.
