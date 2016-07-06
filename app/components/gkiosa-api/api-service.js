(function () {

'use strict';

angular.module('gkiosa.app.components.gkiosaApi')

.factory('gkiosaApi', gkiosaApi);

function gkiosaApi($q) {

  const Datastore = getDBDriver();
  const db = createDbs();

  // insertFakeDocuments();

  return {
    getUserDependencies,

    findUser: createSimpleCrudFind('users'),
    findAllUsers: createSimpleCrudFindAll('users'),
    createUser: createSimpleCrudCreate('users'),
    updateUser,
    deleteUser: createSimpleCrudDelete('users'),

    findProduct: createSimpleCrudFind('products'),
    findAllProducts: createSimpleCrudFindAll('products'),
    createProduct: createSimpleCrudCreate('products'),
    updateProduct: createSimpleCrudUpdate('products'),
    deleteProduct: createSimpleCrudDelete('products'),

    findReceipt: createSimpleCrudFind('receipts'),
    findAllReceipts: createSimpleCrudFindAll('receipts'),
    createReceipt: createCrudCreateWithUserId('receipts'),
    updateReceipt: createCrudUpdateWithUserId('receipts'),
    deleteReceipt: createSimpleCrudDelete('receipts'),

    findInvoice: createSimpleCrudFind('invoices'),
    findAllInvoices: createSimpleCrudFindAll('invoices'),
    createInvoice: createCrudCreateWithUserId('invoices'),
    updateInvoice: createCrudUpdateWithUserId('invoices'),
    deleteInvoice: createSimpleCrudDelete('invoices'),
  };

  function getDBDriver() {
    if (typeof require !== 'undefined') {
      return require('nedb');
    } else if (typeof Nedb !== 'undefined') {
      return Nedb;
    } else {
      throw new Error('Cannot find database');
    }
  }

  function createDbs() {
    const db = {};
    _.forEach(
        ['users', 'products', 'receipts', 'invoices'],
        dbName => db[dbName] = new Datastore({ filename: `db/${dbName}.db`, autoload: true })
      );
    return db;
  }

  function deferredJob(job) {
    const deferred = $q.defer();
    job(deferred);
    return deferred.promise;
  }

  function respHandle(deferred, successCb) {
    return (err, resp) => err ? deferred.reject(err) : deferred.resolve(successCb ? successCb(resp) : resp);
  }

  function createSimpleCrudFind(dbName) {
    return (id) => deferredJob(deferred => db[dbName].find({ _id: id }, respHandle(deferred, users => _.first(users))));
  }

  function createSimpleCrudFindAll(dbName) {
    return (find, pagination, sort) => {
      return $q.all([
        deferredJob(countDeferred => db[dbName].count({}, respHandle(countDeferred))),
        deferredJob(findDeferred => {
          const cursor = db[dbName].find(find || {});
          if (_.isObject(sort)) {
            cursor.sort(sort);
          }
          if (_.isObject(pagination)) {
            cursor.skip((pagination.page - 1) * pagination.count);
            cursor.limit(pagination.count);
          }
          cursor.exec(respHandle(findDeferred));
        })
      ])
      .then(results => {
        return {
          total: results[0],
          results: results[1]
        };
      });
    }
  }

  function createSimpleCrudCreate(dbName) {
    return (record) => deferredJob(deferred => db[dbName].insert(record, respHandle(deferred, record => record)));
  }

  function createSimpleCrudUpdate(dbName) {
    return (id, record) => deferredJob(deferred => db[dbName].update({ _id: id }, record, {}, respHandle(deferred, record => record)));
  }

  function createSimpleCrudDelete(dbName) {
    return (id) => deferredJob(deferred => db[dbName].remove({ _id: id }, {}, respHandle(deferred, numRemoved => numRemoved)));
  }

  function updateUser(user) {
    const userId = user._id;
    return deferredJob(deferred => db['invoices'].update({ userId }, { user }, {}, respHandle(deferred, record => record)))
      .then(deferredJob(deferred => db['receipts'].update({ userId }, { user }, {}, respHandle(deferred, record => record))))
      .then(createSimpleCrudUpdate('users')(userId, user))
  }

  function getUserDependencies(userId) {
    return $q.all([
      createSimpleCrudFindAll('invoices')({ userId }),
      createSimpleCrudFindAll('receipts')({ userId })
    ])
    .then(results => {
      if (_.isEmpty(results[0].results) && _.isEmpty(results[1].results)) {
        return;
      }
      return {
        invoices: results[0].results,
        receipts: results[1].results
      };
    });
  }

  function createCrudCreateWithUserId(dbName) {
    return (record) => populateItems([record], 'user', 'userId', 'users')
      .then(results => _.first(results))
      .then(record => createSimpleCrudCreate(dbName)(record));
  }

  function createCrudUpdateWithUserId(dbName) {
    return (record) => populateItems([record], 'user', 'userId', 'users')
      .then(results => _.first(results))
      .then(record => createSimpleCrudUpdate(dbName)(record._id, record));
  }

  function populateItems(itemsWithUserId, targetKey, destinationKey, populatedDbName) {
    const query = _.chain(itemsWithUserId)
      .uniqBy(itemWithUserId => itemWithUserId[destinationKey])
      .map(itemWithUserId => _.identity({ _id: itemWithUserId[destinationKey]}))
      .value();

    return createSimpleCrudFindAll(populatedDbName)({ $or: query })
      .then(populatedItems => {
        const populatedItemsById = _.groupBy(populatedItems.results, '_id');
        _.each(
          itemsWithUserId,
          itemWithUserId => itemWithUserId[targetKey] = populatedItemsById[itemWithUserId[destinationKey]][0]
        );
        return itemsWithUserId;
      });
  }

  function insertFakeDocuments() {
    const users = _.range(100).map(idx => {
      return {
        name: `name${idx}`,
        code: `code${idx}`,
        debt: 100*idx,
        vat: `vat${idx}`,
        taxAuthority: `taxAuthority${idx}`,
        address: `address${idx}`,
        profession: `profession${idx}`,
        vector: idx%2===0?'SUPPLIERS': 'CUSTOMERS'
      };
    });
    const promiseOfUsers = createSimpleCrudCreate('users')(users);
    promiseOfUsers.then(users => {
      _.range(100).forEach(idx => {
        const receipt =  {
          date: new Date(_.now() - (100000000000 + (idx * 10000000000))),
          receiptNum: idx+100,
          commend: `commend${idx}`,
          bank: idx%2===0 ? idx*100 : 0,
          cash: idx%3===0 ? idx*100 : 0,
          check: idx%5===0 ? idx*100 : 0,
          userId: users[idx]._id,
          vector: idx % 2 === 0 ? 'SUPPLIERS': 'CUSTOMERS'
        };
        createCrudCreateWithUserId('receipts')(receipt);
      });

    });

    const products = _.range(100).map(idx => {
      return {
        productId: `name${idx}`,
        name: `code${idx}`,
        vat: 22,
        vector: idx%2===0?'SUPPLIERS': 'CUSTOMERS'
      };
    });
    const promiseOfProducts = createSimpleCrudCreate('products')(products);

    $q.all([promiseOfUsers, promiseOfProducts])
      .then(results => {
        const users = results[0];
        const products = results[1];
        _.range(100).forEach(idx => {
          const invoicesProducts = [
            _.assignIn({
              price: 200*idx,
              quantity: 4+idx
            }, products[0]),
            _.assignIn({
              price: 300*idx,
              quantity: 5+idx
            }, products[1]),
            _.assignIn({
              price: 400*idx,
              quantity: 6+idx
            }, products[3]),
            _.assignIn({
              price: 600*idx,
              quantity: 7+idx
            }, products[4])
          ];
          const invoice =  {
            products: invoicesProducts,
            date: new Date(_.now() - (100000000000 + (idx * 10000000000))),
            userId: users[idx]._id,
            credit: idx%2===0,
            invoiceNum: idx*100,
            vector: idx%2===0?'SUPPLIERS': 'CUSTOMERS'
          };
          createCrudCreateWithUserId('invoices')(invoice);
        });
      });
  }
}

})();
