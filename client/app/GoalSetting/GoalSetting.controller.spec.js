'use strict';

describe('Controller: GoalSettingCtrl', function () {

  // load the controller's module
  beforeEach(module('yourfundFullstackApp'));

  var GoalSettingCtrl, scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    GoalSettingCtrl = $controller('GoalSettingCtrl', {
      $scope: scope
    });
  }));

  it('should ...', function () {
    expect(1).toEqual(1);
  });
});
