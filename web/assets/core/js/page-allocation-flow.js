'use strict';

vm.pageTitle('Allocation Flow');
vm.breadcrumb([{ title: 'Godrej', href: '#' }, { title: 'Allocation Flow', href: '/allocationflow' }]);

viewModel.allocationFlow = new Object();
var af = viewModel.allocationFlow;

af.modules = ko.observableArray([{ _id: "n001", Name: "Module Lorem" }, { _id: "n002", Name: "Module Ipsum" }, { _id: "n003", Name: "Module Dolor" }, { _id: "n004", Name: "Module Sit" }, { _id: "n005", Name: "Module Amet" }]);
af.prepareDrag = function () {
	$('.available-module').sortable({
		connectWith: '.list-group.module'
	});
	$('.applied-module').sortable({
		connectWith: '.list-group.module'
	});
};

$(function () {
	af.prepareDrag();
});