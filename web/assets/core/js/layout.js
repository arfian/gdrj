'use strict';

var vm = viewModel;

vm.currentMenu = ko.observable('Dashboard');
vm.currentTitle = ko.observable('Dashboard');
vm.menu = ko.observableArray([{ title: 'Home', icon: 'home', href: viewModel.appName + 'page/home', submenu: [] }, { title: 'P&L Performance', icon: 'tachometer', href: viewModel.appName + 'page/pnlperformance', submenu: [] }, { title: 'Analysis', icon: 'bar-chart-o', href: '#', submenu: [{ title: 'Key Account Analysis', icon: 'bar-chart-o', href: viewModel.appName + 'page/keyaccountanalysis', submenu: [] }, { title: 'Branch Analysis', icon: 'bar-chart-o', href: viewModel.appName + 'page/branchanalysis', submenu: [] }, { title: 'RD Analysis', icon: 'bar-chart-o', href: viewModel.appName + 'page/rdanalysis', submenu: [] }, { title: 'Custom Analysis', icon: 'bar-chart-o', href: viewModel.appName + 'page/customanalysis', submenu: [] }] },
// { title: 'Report', icon: 'file-text-o', href: viewModel.appName + 'page/report/list', submenu: [] },
{ title: 'Data Manager', icon: 'database', href: '#', submenu: [{ title: 'Data Browser', icon: 'list', href: viewModel.appName + 'page/databrowser', submenu: [] }, { title: 'Upload Data', icon: 'upload', href: viewModel.appName + 'page/uploaddata', submenu: [] }] }, { title: 'Organization', icon: 'sitemap', href: viewModel.appName + 'page/organization', submenu: [] }, { title: 'Administration', icon: 'gear', href: '#', submenu: [
	// { title: 'Allocation Flow', icon: 'arrows', href: viewModel.appName + 'page/allocationflow', submenu: [] },
	{ title: 'Access', icon: 'unlock-alt', href: viewModel.appName + 'page/access', submenu: [] }, { title: 'Group', icon: 'users', href: viewModel.appName + 'page/group', submenu: [] }, { title: 'User', icon: 'user', href: viewModel.appName + 'page/user', submenu: [] }, { title: 'Session', icon: 'clock-o', href: viewModel.appName + 'page/session', submenu: [] }, { title: 'Log', icon: 'book', href: viewModel.appName + 'page/log', submenu: [] }, { title: 'Admin Collection', icon: 'table', href: viewModel.appName + 'page/admintable', submenu: [] }] }]);

vm.breadcrumb = ko.observableArray([{ title: 'Godrej', href: '#' }, { title: 'Dashboard', href: '#' }]);

vm.menuIcon = function (data) {
	return ko.computed(function () {
		return 'fa fa-' + data.icon;
	});
};

vm.prepareDropDownMenu = function () {
	$('ul.nav li.dd-hover').hover(function () {
		$(this).find('.dropdown-menu').stop(true, true).fadeIn(200);
	}, function () {
		$(this).find('.dropdown-menu').stop(true, true).fadeOut(200);
	});
};

vm.prepareFilterToggle = function () {
	$('.material-switch input[type="checkbox"]').on('change', function () {
		var show = $(this).is(':checked');
		var $target = $(this).closest('.panel').find('.panel-filter');
		if (show) {
			$target.show(200);
		} else {
			$target.hide(200);
		}
	}).trigger('click');
};
vm.adjustLayout = function () {
	var height = window.innerHeight - $('.app-top').height();
	$('.app-container').css('min-height', height);
};
vm.showFilterCallback = toolkit.noop;
vm.showFilter = function () {
	var btnToggleFilter = $('.btn-toggle-filter');
	var panelFilterContainer = $('.panel-filter').parent();

	panelFilterContainer.removeClass('minimized');
	btnToggleFilter.find('.fa').removeClass('color-blue').addClass('color-orange').removeClass('fa-angle-double-right').addClass('fa-angle-double-left');

	$('.panel-filter').show(300);
	$('.panel-content').animate({ 'width': 'auto' }, 300, vm.showFilterCallback);
};
vm.hideFilterCallback = toolkit.noop;
vm.hideFilter = function () {
	var btnToggleFilter = $('.btn-toggle-filter');
	var panelFilterContainer = $('.panel-filter').parent();

	panelFilterContainer.addClass('minimized');
	btnToggleFilter.find('.fa').removeClass('color-orange').addClass('color-blue').removeClass('fa-angle-double-left').addClass('fa-angle-double-right');

	$('.panel-filter').hide(300);
	$('.panel-content').animate({ 'width': '100%' }, 300, vm.hideFilterCallback);
};
vm.prepareToggleFilter = function () {
	var btnToggleFilter = $('.btn-toggle-filter');
	var panelFilterContainer = $('.panel-filter').parent();

	$('<i class="fa fa-angle-double-left tooltipster align-center color-orange" title="Toggle filter pane visibility"></i>').appendTo(btnToggleFilter);
	toolkit.prepareTooltipster($(btnToggleFilter).find('.fa'));

	btnToggleFilter.on('click', function () {
		if (panelFilterContainer.hasClass('minimized')) {
			vm.showFilter();
		} else {
			vm.hideFilter();
		}
	});
};
vm.prepareLoader = function () {
	$('.loader canvas').each(function (i, cvs) {
		var ctx = cvs.getContext("2d");
		var sA = Math.PI / 180 * 45;
		var sE = Math.PI / 180 * 90;
		var ca = canvas.width;
		var ch = canvas.height;

		ctx.clearRect(0, 0, ca, ch);
		ctx.lineWidth = 15;

		ctx.beginPath();
		ctx.strokeStyle = "#ffffff";
		ctx.shadowColor = "#eeeeee";
		ctx.shadowOffsetX = 2;
		ctx.shadowOffsetY = 2;
		ctx.shadowBlur = 5;
		ctx.arc(50, 50, 25, 0, 360, false);
		ctx.stroke();
		ctx.closePath();

		sE += 0.05;
		sA += 0.05;

		ctx.beginPath();
		ctx.strokeStyle = "#aaaaaa";
		ctx.arc(50, 50, 25, sA, sE, false);
		ctx.stroke();
		ctx.closePath();
	});
};
vm.logout = function () {
	toolkit.ajaxPost(viewModel.appName + 'login/logout', {}, function (res) {
		if (!toolkit.isFine(res)) {
			return;
		}
		swal({
			title: 'Logout Success',
			text: 'Will automatically redirect to login page in 3 seconds',
			type: 'success',
			timer: 3000,
			showConfirmButton: false
		}, function () {
			location.href = viewModel.appName + 'page/login';
		});
	});
};

$(function () {
	vm.prepareDropDownMenu();
	vm.prepareFilterToggle();
	vm.adjustLayout();
	vm.prepareToggleFilter();
	toolkit.prepareTooltipster();
	vm.prepareLoader();
});