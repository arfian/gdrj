'use strict';

vm.currentMenu('Growth Analysis');
vm.currentTitle("&nbsp;");
vm.breadcrumb([{ title: 'Godrej', href: '#' }, { title: 'Growth Analysis', href: '/report/growthanalysis' }]);

viewModel.growth = {};
var growth = viewModel.growth;

growth.fiscalYears = ko.observableArray(rpt.value.FiscalYears());
growth.contentIsLoading = ko.observable(false);
growth.data = ko.observableArray([]);
growth.breakdownBy = ko.observable('customer.channelname');
growth.breakdownNote = ko.observable('');

growth.refresh = function () {
	var useCache = arguments.length <= 0 || arguments[0] === undefined ? false : arguments[0];

	// if (kac.breakdownValue().length == 0) {
	// 	toolkit.showError('Please choose at least breakdown value')
	// 	return
	// }

	var param = {};
	param.pls = [];
	param.groups = rpt.parseGroups([growth.breakdownBy(), "date.year", "date.quartertxt"]);
	// param.groups = rpt.parseGroups([growth.breakdownBy()])
	param.aggr = 'sum';
	param.filters = rpt.getFilterValue(false, growth.fiscalYear);

	growth.contentIsLoading(true);

	var fetch = function fetch() {
		toolkit.ajaxPost(viewModel.appName + "report/getpnldatanew", param, function (res) {
			if (res.Status == "NOK") {
				setTimeout(function () {
					fetch();
				}, 1000 * 5);
				return;
			}

			var date = moment(res.time).format("dddd, DD MMMM YYYY HH:mm:ss");
			growth.breakdownNote('Last refreshed on: ' + date);

			console.log(res.Data.Data);
			growth.data(res.Data.Data);
			rpt.plmodels(res.Data.PLModels);
			growth.emptyGrid();
			growth.contentIsLoading(false);
			growth.render();
		}, function () {
			growth.emptyGrid();
			growth.contentIsLoading(false);
		}, {
			cache: useCache == true ? 'breakdown chart' : false
		});
	};

	fetch();
};

growth.emptyGrid = function () {
	$('.breakdown-view').replaceWith('<div class="breakdown-view ez" id="pnl-analysis"></div>');
};

growth.render = function () {
	var wrapper = toolkit.newEl('div').addClass('pivot-pnl').appendTo($('.breakdown-view'));

	var tableHeaderWrap = toolkit.newEl('div').addClass('table-header').appendTo(wrapper);

	var tableHeader = toolkit.newEl('table').addClass('table').appendTo(tableHeaderWrap);

	var tableContentWrap = toolkit.newEl('div').appendTo(wrapper).addClass('table-content');

	var tableContent = toolkit.newEl('table').addClass('table').appendTo(tableContentWrap);

	var trHeader1 = toolkit.newEl('tr').appendTo(tableHeader);
};

rpt.refresh = function () {
	rpt.tabbedContent();
	// rpt.refreshView('analysis')

	// rs.getSalesHeaderList()

	// bkd.changeBreakdown()
	setTimeout(function () {
		// bkd.breakdownValue(['All'])
		growth.refresh(false);
		$("ul.nav-pills").find('li').removeClass("active");
		$('a[field=\'' + growth.breakdownBy() + '\']').parent().addClass('active');
	}, 200);

	rpt.prepareEvents();

	// ccr.getDecreasedQty(false)
};

rpt.selectBreakDown = function (d, e) {
	// console.log(d, $(e.target).closest(".nav-pills"))
	$(e.target).closest(".nav-pills").find('li').removeClass("active");
	$(e.target).parent().addClass('active');
	growth.breakdownBy($(e.target).attr('field'));
};

$(function () {
	rpt.refresh();
});