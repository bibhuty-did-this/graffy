import Graffy from '../Graffy.js';
import GraffyFill from '@graffy/fill';

test('Porcelain read', async () => {
  const store = new Graffy();
  store.use(GraffyFill());

  const expectedBooksQuery = [
    {
      $key: { $first: 2 },
      title: true,
      author: { name: true },
    },
  ];

  const expectedUsersQuery = {
    clarke: { name: true },
    orwell: { name: true },
  };

  const onReadBooks = jest.fn(() => [
    { $key: ['1984'], title: '1984', author: { $ref: 'users.orwell' } },
    { $key: ['2001'], title: '2001', author: { $ref: 'users.clarke' } },
  ]);

  const onReadUsers = jest.fn(() => ({
    orwell: { name: 'George Orwell' },
    clarke: { name: 'Arthur C Clarke' },
  }));

  store.onRead('books', onReadBooks);
  store.onRead('users', onReadUsers);

  const result = await store.read('books', {
    $key: { $first: 2 },
    title: true,
    author: { name: true },
  });

  const expectedResult = [
    {
      $key: ['1984'],
      title: '1984',
      author: { $ref: ['users', 'orwell'], name: 'George Orwell' },
    },
    {
      $key: ['2001'],
      title: '2001',
      author: { $ref: ['users', 'clarke'], name: 'Arthur C Clarke' },
    },
  ];
  expectedResult.$page = { $all: true, $until: ['2001'] };
  expectedResult.$next = { $first: 2, $after: ['2001'] };
  expectedResult.$prev = null;

  expect(onReadBooks).toHaveBeenCalledWith(
    expectedBooksQuery,
    expect.any(Object),
  );
  expect(onReadBooks.mock.calls[0][0].$key).toEqual(expectedBooksQuery.$key);
  expect(onReadUsers).toHaveBeenCalledWith(
    expectedUsersQuery,
    expect.any(Object),
  );
  expect(result).toEqual(expectedResult);
});

const forever = new Promise(() => {});

test('Porcelain subscription', async () => {
  const store = new Graffy();
  store.use(GraffyFill());

  const onWatchBooks = async function* onWatchBooks() {
    yield [
      {
        $key: ['1984'],
        title: '1984',
        author: { $ref: 'users.orwell' },
      },
      {
        $key: ['2001'],
        title: '2001',
        author: { $ref: 'users.clarke' },
      },
    ];
    await forever;
  };

  const onWatchUsers = async function* onWatchUsers() {
    yield {
      orwell: { name: 'George Orwell' },
      clarke: { name: 'Arthur C Clarke' },
    };
    await forever;
  };

  store.onWatch('books', onWatchBooks);
  store.onWatch('users', onWatchUsers);

  const result = store.watch('books', {
    $key: { $first: 2 },
    title: true,
    author: { name: true },
  });
  const expectedResult = [
    {
      $key: ['1984'],
      title: '1984',
      author: { $ref: ['users', 'orwell'], name: 'George Orwell' },
    },
    {
      $key: ['2001'],
      title: '2001',
      author: { $ref: ['users', 'clarke'], name: 'Arthur C Clarke' },
    },
  ];
  expectedResult.$page = { $all: true, $until: ['2001'] };
  expectedResult.$next = { $first: 2, $after: ['2001'] };
  expectedResult.$prev = null;

  expect((await result.next()).value).toEqual(expectedResult);
});

test('write array value', async () => {
  const store = new Graffy();
  store.use(GraffyFill());

  const provider = jest.fn((change) => {
    const expected = ['hello', 'world'];
    expected.$val = true;
    expect(change).toEqual({ foo: expected });
    return { foo: { $val: ['hello', 'world'] } };
  });
  store.onWrite(provider);

  await store.write({ foo: { $val: ['hello', 'world'] } });
  expect(provider).toBeCalled();
});

test('read array value', async () => {
  const store = new Graffy();
  store.use(GraffyFill());

  const provider = jest.fn(() => {
    return { foo: { $val: ['hello', 'world'] } };
  });
  store.onRead(provider);

  const result = await store.read({ foo: 1 });
  expect(provider).toBeCalled();
  const expected = ['hello', 'world'];
  expected.$val = true;
  expect(result).toEqual({ foo: expected });
});

test('basic_range', async () => {
  const query = {
    foo: {
      $key: { $first: 2, bar: 'something' },
      id: 1,
      name: 1,
    },
  };

  const store = new Graffy();

  store.use((_store) => {
    _store.onRead('foo', async (_query, _options) => {
      return [
        {
          $key: {
            $cursor: [1],
            bar: 'something',
          },
          id: 'id-1',
          name: 'name-1',
          address: 'address-1',
        },
        {
          $key: {
            $cursor: [2],
            bar: 'something',
          },
          id: 'id-2',
          name: 'name-2',
          address: 'address-2',
        },
        {
          $key: {
            $cursor: [3],
            bar: 'something',
          },
          id: 'id-3',
          name: 'name-3',
          address: 'address-3',
        },
      ];
    });
  });

  const result = await store.read(query);
  const expected = {
    foo: [
      {
        $key: {
          $cursor: [1],
          bar: 'something',
        },
        id: 'id-1',
        name: 'name-1',
      },
      {
        $key: {
          $cursor: [2],
          bar: 'something',
        },
        id: 'id-2',
        name: 'name-2',
      },
    ],
  };
  expected.foo.$page = { bar: 'something', $all: true, $until: [2] };
  expected.foo.$next = { bar: 'something', $first: 2, $after: [2] };
  expected.foo.$prev = null;

  expect(result).toEqual(expected);
});

test('query_forwarding', async () => {
  /*
    At this point, this is not a requirement:
    The *result*

  */
  const query = {
    foo: {
      $key: { $first: 2, bar: 'something' },
      id: 1,
      name: 1,
    },
  };

  const store = new Graffy();
  const store2 = new Graffy();

  store.use((_store) => {
    _store.onRead('foo', async (_query, _options) => {
      return [
        {
          $key: {
            $cursor: [1],
            bar: 'something',
          },
          id: 'id-1',
          name: 'name-1',
          address: 'address-1',
        },
        {
          $key: {
            $cursor: [2],
            bar: 'something',
          },
          id: 'id-2',
          name: 'name-2',
          address: 'address-2',
        },
        {
          $key: {
            $cursor: [3],
            bar: 'something',
          },
          id: 'id-3',
          name: 'name-3',
          address: 'address-3',
        },
      ];
    });
  });
  store2.onRead((...args) => store.read(...args));

  const result = await store2.read(query);
  const expected = {
    foo: [
      {
        $key: {
          $cursor: [1],
          bar: 'something',
        },
        id: 'id-1',
        name: 'name-1',
      },
      {
        $key: {
          $cursor: [2],
          bar: 'something',
        },
        id: 'id-2',
        name: 'name-2',
      },
    ],
  };
  expected.foo.$page = { bar: 'something', $all: true, $until: [2] };
  expected.foo.$next = { bar: 'something', $first: 2, $after: [2] };
  expected.foo.$prev = null;

  expect(result).toEqual(expected);
});

test('read_leaf', async () => {
  const store = new Graffy();
  const provider = jest.fn(() => ({ bar: 44 }));
  store.onRead('foo', provider);
  const res = await store.read('foo.bar', true);

  expect(provider).toHaveBeenCalledWith({ bar: true }, {});
  expect(res).toBe(44);
});

test('write_leaf', async () => {
  const store = new Graffy();
  const provider = jest.fn(() => ({ bar: 45 }));
  store.onWrite('foo', provider);
  const res = await store.write('foo.bar', 45);

  expect(provider).toHaveBeenCalledWith({ bar: 45 }, {});
  expect(res).toBe(45);
});

test('delete_leaf', async () => {
  const store = new Graffy();
  const provider = jest.fn(() => ({ bar: null }));
  store.onWrite('foo', provider);
  const res = await store.write('foo.bar', null);

  expect(provider).toHaveBeenCalledWith({ bar: null }, {});
  expect(res).toBe(null);
});

test('read_key', async () => {
  const store = new Graffy();
  const provider = jest.fn(() => ({ bar: 44 }));
  store.onRead('foo', provider);
  const res = await store.read('foo', { $key: 'bar' });

  expect(provider).toHaveBeenCalledWith({ bar: true }, {});
  expect(res).toEqual([44]); // Can't add $key:bar on the number 44
});

test('read_array_key', async () => {
  const store = new Graffy();
  const provider = jest.fn(() => ({ bar: 44 }));
  store.onRead('foo', provider);
  const res = await store.read('foo', [{ $key: 'bar' }]);

  expect(provider).toHaveBeenCalledWith({ bar: true }, {});
  expect(res).toEqual([44]);
});

test('write_key', async () => {
  const store = new Graffy();
  const provider = jest.fn(() => ({ bar: 44 }));
  store.onWrite('foo', provider);
  const res = await store.write('foo', { $key: 'bar', $val: 44 });

  expect(provider).toHaveBeenCalledWith({ bar: 44 }, {});
  expect(res).toEqual({ bar: 44 });
});

test('write_array_key', async () => {
  const store = new Graffy();
  const provider = jest.fn(() => ({ bar: 44 }));
  store.onWrite('foo', provider);
  const res = await store.write('foo', [{ $key: 'bar', $val: 44 }]);

  expect(provider).toHaveBeenCalledWith({ bar: 44 }, {});
  expect(res).toEqual({ bar: 44 });
});

test('write_key_put', async () => {
  const store = new Graffy();
  const provider = jest.fn(() => ({ bar: { baz: 4, $put: true } }));
  store.onWrite('foo', provider);
  const res = await store.write('foo', { $key: 'bar', $put: true, baz: 4 });

  expect(provider).toHaveBeenCalledWith({ bar: { $put: true, baz: 4 } }, {});
  expect(res).toEqual({ bar: { baz: 4, $put: true } });
});
