angular.module('gkiosa.app', [
  'ngAnimate',
  'toastr',
  'ngSanitize',
  'ui.select',
  'ui.bootstrap',
  'ui.router',
  'ngTable',
  'cgBusy',
  'ngBootbox',
  'gkiosa.app.sections.dashboard',
  'gkiosa.app.sections.users',
  'gkiosa.app.sections.users.user',
  'gkiosa.app.sections.users.allUsers',
  'gkiosa.app.sections.products',
  'gkiosa.app.sections.products.product',
  'gkiosa.app.sections.products.allProducts',
  'gkiosa.app.sections.receipts',
  'gkiosa.app.sections.receipts.receipt',
  'gkiosa.app.sections.receipts.allReceipts',
  'gkiosa.app.sections.invoices',
  'gkiosa.app.sections.invoices.invoice',
  'gkiosa.app.sections.invoices.allInvoices',
  'gkiosa.app.sections.mixedItems',
  'gkiosa.app.sections.about',
  'gkiosa.app.sections.backup',
  'gkiosa.app.sections.licence',
  'gkiosa.app.components.filters',
  'gkiosa.app.components.gkiosaApi',
  'gkiosa.app.components.pagination',
  'gkiosa.app.components.charts',
  'gkiosa.app.components.dateRangePicker',
  'gkiosa.app.components.context',
  'gkiosa.app.components.fileUtilities',
  'gkiosa.app.components.pdfGenerator',
  'gkiosa.app.components.initApp'
])

.run(() => window.gksAssert  = (cond, msg) => console.assert(cond, msg))

.value('cgBusyDefaults', {
  templateUrl: 'components/theming/cg-busy-template.html',
  minDuration: 200
})

.config($urlRouterProvider => {
  $urlRouterProvider.otherwise('/mixedItems');
})

.config(toastrConfig => {
  toastrConfig.autoDismiss = false;
  toastrConfig.closeButton = true;
  toastrConfig.closeHtml = '<button>&times;</button>';
  toastrConfig.customTemplate = false;
  toastrConfig.extendedTimeOut = '5000';
  toastrConfig.html = true;
  toastrConfig.allowHtml = true;
  toastrConfig.maxOpened = 0;
  toastrConfig.newestOnTop = true;
  toastrConfig.position = 'toast-top-right';
  toastrConfig.preventDuplicates = false;
  toastrConfig.preventOpenDuplicates = false;
  toastrConfig.progressBar = true;
  toastrConfig.tapToDismiss = true;
  toastrConfig.timeOut = '5000';
})

.run(NgTableParams => {
  NgTableParams.prototype.customFilters = {
    boolean: (filters, key) => {
      const val = filters[key];
      filters[key] = val === undefined ? true : undefined;
    }
  };
})

.run(() => {
  math.config({
    number: 'BigNumber',
    precision: 20
  });
  math.do = str => math.eval(str).toDecimalPlaces(2).toNumber();
})

.config($ngBootboxConfigProvider => {
  $ngBootboxConfigProvider.addLocale('gr', {
    OK : 'OK',
    CANCEL : 'Άκυρο',
    CONFIRM : 'Επιβεβαίωση'
  });
  $ngBootboxConfigProvider.setDefaultLocale('gr');
})

.value('gkiosaConfig', {
  technicalContact: 'john.apostolidi@gmail.com',
  technicalName: 'Γιάννης Αποστολίδης'
})

.controller('AppController', AppController);

function AppController($rootScope, $scope, $state, gkiosaInitApp) {
  const self = this;

  gkiosaInitApp.init();

  self.sidebarMenu = getSidebarMenu();
  self.sidebarMenuClicked = sidebarMenuClicked;
  self.historyGoBack = historyGoBack;
  self.historyGoForward = historyGoForward;

  $rootScope.$on("$stateChangeStart", onStateChangeStart);

  function sidebarMenuClicked() {
    _.delay(() => $state.reload(), 200);
  }

  function onStateChangeStart(event, toState, toParams, fromState, fromParams) {
    self.breadcrumb = toState.getBreadcrumbName(toParams);
    self.activeSidebarMenuId = toState.getActiveMenuId(toParams);
  }

  function historyGoBack() {
    window.history.back();
    _.defer(() => $state.reload());
  }

  function historyGoForward() {
    window.history.forward();
    _.defer(() => $state.reload());
  }

  function getSidebarMenu() {
    return [
      {
        sref: "dashboard",
        name: 'Πίνακας ελέγχου',
        icon: 'fa-th-large',
        id: 'dashboard'
      },
      {
        sref: "mixedItems",
        name: 'Αναζήτηση',
        icon: 'fa-th-large',
        id: 'mixedItems'
      },
      {
        sref: "users.all({vector: 'CUSTOMERS'})",
        name: 'Πελάτες',
        icon: 'fa-th-large',
        id: 'users.all.customers'
      },
      {
        sref: "users.all({vector: 'SUPPLIERS'})",
        name: 'Προμηθευτές',
        icon: 'fa-th-large',
        id: 'users.all.suppliers'
      },
      {
        sref: "invoices.all({vector: 'CUSTOMERS'})",
        name: 'Τιμολόγια πώλησης',
        icon: 'fa-th-large',
        id: 'invoices.all.customers'
      },
      {
        sref: "invoices.all({vector: 'SUPPLIERS'})",
        name: 'Τιμολόγια αγοράς',
        icon: 'fa-th-large',
        id: 'invoices.all.suppliers'
      },
      {
        sref: "receipts.all({vector: 'CUSTOMERS'})",
        name: 'Αποδείξεις είσπραξης',
        icon: 'fa-th-large',
        id: 'receipts.all.customers'
      },
      {
        sref: "receipts.all({vector: 'SUPPLIERS'})",
        name: 'Αποδείξεις πληρωμής',
        icon: 'fa-th-large',
        id: 'receipts.all.suppliers'
      },
      {
        sref: "products.all({vector: 'CUSTOMERS'})",
        name: 'Προιόντα πώλησης',
        icon: 'fa-th-large',
        id: 'products.all.customers'
      },
      {
        sref: "products.all({vector: 'SUPPLIERS'})",
        name: 'Προιόντα αγοράς',
        icon: 'fa-th-large',
        id: 'products.all.suppliers'
      }
    ];
  }
};
