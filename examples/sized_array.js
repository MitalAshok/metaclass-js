const MetaClass = require('metaclass');

const SizedArray = module.exports.SizedArray = class SizedArray extends MetaClass {
  constructor(length, name = null, use_empty_slots = false) {
    length = Number(length);
    length = Array(length).length;
    use_empty_slots = Boolean(use_empty_slots);
    name = name === null ? 'SizedArray(' + length + (use_empty_slots ? ', true' : '') + ')' : name;
    const prototype = Object.create(Array.prototype);
    prototype.constructor = function constructor(...args) {
      if (args.length > length) {
        throw RangeError('Too many arguments to construct ' + name + ' (Expected: ' + length + ', got: ' + args.length + ')');
      }
      let i;
      for (i = 0; i < args.length; i++) {
        this[i] = args[i];
      }
      if (!use_empty_slots) {
        for (; i < length; i++) {
          this[i] = undefined;
        }
      }
      Object.defineProperty(this, 'length', {value: length, writable: false, enumerable: false, configurable: false});
    };
    Object.defineProperty(prototype, 'length', {value: length, writable: true, enumerable: false, configurable: true});
    Object.defineProperty(prototype, Symbol.toStringTag, {value: name, writable: false, enumerable: false, configurable: true});
    super(name, prototype);
    Object.defineProperty(this, SizedArray.use_empty_slots_symbol, {
      value: use_empty_slots,
      writable: false,
      enumerable: false,
      configurable: false
    });
  }
};

const Array_static_properties = Object.getOwnPropertyDescriptors(Array);
delete Array_static_properties.constructor;
delete Array_static_properties.length;
delete Array_static_properties.prototype;
delete Array_static_properties.name;
Object.defineProperties(SizedArray.prototype, Array_static_properties);

Object.defineProperty(SizedArray, 'use_empty_slots_symbol', {
  value: Symbol('SizedArray##use_empty_slots_symbol'),
  writable: false,
  enumerable: false,
  configurable: false
});


module.exports.Pair = class Pair extends new SizedArray(2, false, 'Pair') {
  get first() {
    return this[0];
  }
  get second() {
    return this[1];
  }
};

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

const index_names_symbol = Symbol('NamedArray#index_names');

module.exports.NamedArray = class NamedArray extends SizedArray {
  constructor(name, index_names) {
    if (typeof index_names === 'string' || index_names instanceof String) {
      index_names = String(index_names).split(/ /g);
    } else {
      index_names = Array.from(index_names);
    }
    if ((new Set(index_names)).size !== index_names.length) {
      throw Error('NamedArray index_names contains duplicates.');
    }
    super(index_names.length, name);
    for (let i = 0; i < index_names.length; i++) {
      Object.defineProperty(this.prototype, index_names[i], create_property(i));
    }
    Object.defineProperty(this.prototype, index_names_symbol, {
      value: index_names,
      writable: false,
      enumerable: false,
      configurable: false
    });
  }
  from_object(obj) {
    const arr = new this();
    for (const name of this[index_names_symbol]) {
      arr[name] = obj[name];
    }
    return arr;
  }
};
