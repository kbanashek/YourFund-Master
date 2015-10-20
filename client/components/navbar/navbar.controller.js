'use strict';

angular.module('yourfundFullstackApp')
  .controller('NavbarCtrl', function ($scope, $location, Auth, loginModal) {
    $scope.menu = [{
      'title': 'Home',
      'link': '/'
    }];

    $scope.isCollapsed = true;
    $scope.isLoggedIn = Auth.isLoggedIn;
    $scope.isAdmin = Auth.isAdmin;
    $scope.getCurrentUser = Auth.getCurrentUser;

    $scope.logout = function () {
      Auth.logout();
      $location.path('/home');
    };

    $scope.login = function () {
      loginModal();
    };


    $scope.isGettingStartedActive = function () {
      if ($location.path() === '/orientation' ||
        $location.path() === '/Risk' ||
        $location.path() === '/GoalSetting' ||
        $location.path() === '/Pricing' ||
        $location.path() === '/Help' ||
        $location.path() === '/Aboutus'
      ) {
        return true;
      }
      else {
        return false;
      }
    };


    $scope.isActive = function (route) {
      return route === $location.path();
    };


  });
