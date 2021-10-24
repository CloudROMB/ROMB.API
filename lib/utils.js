module.exports.roughSizeOfObject = (object) => {
  let objectList = [];

  let recurse = function (value) {
    let bytes = 0;

    if (typeof value === 'boolean') {
      bytes = 4;
    }
    else if (typeof value === 'string') {
      bytes = value.length * 2;
    }
    else if (typeof value === 'number') {
      bytes = 8;
    }
    else if (
      typeof value === 'object'
      && objectList.indexOf(value) === -1
    ) {
      objectList[objectList.length] = value;

      for (let i in value) {
        bytes += 8; // an assumed existence overhead
        if (value.hasOwnProperty(i)) bytes += recurse(value[i]);
      }
    }

    return bytes;
  };

  try {
    return recurse(object);
  } catch (err) {
    return Number.MAX_VALUE;
  }
};
