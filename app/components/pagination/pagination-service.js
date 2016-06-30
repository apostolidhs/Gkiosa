(function () {

'use strict';

angular.module('gkiosa.app.components.pagination')

.factory('gkiosaPagination', gkiosaPagination);

function gkiosaPagination(
  $state,
  $stateParams,
  NgTableParams,
  gkiosaApi
) {

  return {
    createNgTableParams
  };

  // host {vector, items, promise}
  function createNgTableParams(host, targetDb, sortingKey) {
    const tableParams = urlToTableParams(sortingKey);
    const tableSettings = {
      filterDelay: 300,
      getData: params => {
        addTableParamsToUrl(params.parameters());
        const find = {vector: host.vector};
        _.transform(params.filter(), (result, value, key) => {
          if (!_.isNil(value)) {
            let normalizedVal;
            if (_.isString(value)) {
              normalizedVal = new RegExp(value);
            } else if (_.isNumber(value)) {
              normalizedVal = value;
            } else if (_.isDate(value)) {
              normalizedVal = {
                $lte: new Date(value.getTime() + 24 * 60 * 60 * 1000),
                $gte: value
              };
              console.log(JSON.stringify(normalizedVal));
            } else {
              throw new Error(`Unsupported value type: ${value}`);
            }
            result[key] = normalizedVal;
          }
        }, find);

        const pagination = {
          count: params.count(),
          page: params.page()
        };
        const sorting = _.mapValues(params.sorting(), sort => sort === 'asc' ? 1 : -1);
        const promise = gkiosaApi[`findAll${targetDb}`](find, pagination, sorting).then(resp => {
          params.total(resp.total);
          const items = resp.results;
          host.items = items;
          return items;
        });
        host.promise = promise;
        return promise;
      }
    };
    return new NgTableParams(tableParams, tableSettings);
  }

  function urlToTableParams(sortingKey) {
    const params = $stateParams.table && JSON.parse(decodeURI($stateParams.table)) || {};
    const defaultParams = {
      page: 1, // show first page
      count: 10, // count per page
      sorting: {}
    };
    defaultParams.sorting[sortingKey] = 'asc'

    return _.defaults(params, defaultParams);
  }

  function addTableParamsToUrl(tableParams) {
    const urlParam = encodeURI(JSON.stringify(tableParams));
    $stateParams.table = urlParam;
    $state.transitionTo($state.current, $stateParams);
  }
}

})();
