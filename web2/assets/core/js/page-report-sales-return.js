'use strict';

viewModel.salesReturn = {};
var sr = viewModel.salesReturn;
sr.contentIsLoading = ko.observable(false);
sr.plGrossSales = ko.observable('PL0');
sr.plSalesReturn = ko.observable('salesreturn');
sr.breakdown = ko.observable('customer.channelname');
sr.fiscalYear = ko.observable(rpt.value.FiscalYear());
sr.title = ko.observable('Sales Return by Channels');
sr.breakdownChannels = ko.observableArray([]);

sr.changeTo = function (d, e) {
	sr.title(e);
	sr.breakdown(d);
	sr.refresh();
};

sr.refresh = function () {
	var param = {};
	param.pls = [];
	param.groups = rpt.parseGroups([sr.breakdown()]);
	param.aggr = 'sum';
	param.filters = rpt.getFilterValue(false, sr.fiscalYear);

	if (sr.breakdownChannels().length > 0) {
		param.groups.push('customer.reportsubchannel');
		param.filters.push({
			Field: 'customer.channelname',
			Op: '$in',
			Value: sr.breakdownChannels()
		});
	}

	var fetch = function fetch() {
		toolkit.ajaxPost(viewModel.appName + "report/getpnldatanew", param, function (res) {
			if (res.Status == "NOK") {
				setTimeout(function () {
					fetch();
				}, 1000 * 5);
				return;
			}

			if (rpt.isEmptyData(res)) {
				sr.contentIsLoading(false);
				return;
			}

			sr.contentIsLoading(false);
			sr.render(res);
		}, function () {
			sr.contentIsLoading(false);
		});
	};

	sr.contentIsLoading(true);
	fetch();
};

sr.render = function (res) {
	var key = '_id_' + toolkit.replace(sr.breakdown(), '.', '_');
	var subKey = '_id_customer_reportsubchannel';
	var data = _.orderBy(res.Data.Data, function (d) {
		return d[sr.plGrossSales()];
	}, 'desc');
	var rowGrossSales = { name: 'Gross Sales' };
	var rowSalesReturn = { name: 'Sales Return' };
	var rowPercentage = { name: 'Percentage' };

	var columns = [];
	columns.push({
		title: '&nbsp;',
		field: 'name',
		width: 150,
		locked: true,
		attributes: { style: 'font-weight: bold;' }
	}, {
		title: 'Total',
		field: 'total',
		width: 150,
		locked: true,
		attributes: { style: 'font-weight: bold;', class: 'align-right' },
		headerAttributes: { style: 'text-align: center !important; font-weight: bold;' },
		template: function template(d) {
			if (d.name == 'Percentage') {
				return kendo.toString(d['total'], 'n2') + ' %';
			}

			return kendo.toString(d['total'], 'n0');
		}
	});

	if (sr.breakdownChannels().length == 0) {
		rowGrossSales['total'] = 0;
		rowSalesReturn['total'] = 0;
		rowPercentage['total'] = 0;

		data.forEach(function (d) {
			var holder = toolkit.replace(d._id[key].toLowerCase(), ['.', '/', "'", '"', "\\", "-"], '_');

			rowGrossSales[holder] = d[sr.plGrossSales()];
			rowSalesReturn[holder] = d[sr.plSalesReturn()];
			rowPercentage[holder] = Math.abs(toolkit.number(d[sr.plSalesReturn()] / d[sr.plGrossSales()]) * 100);

			rowGrossSales['total'] += rowGrossSales[holder];
			rowSalesReturn['total'] += rowSalesReturn[holder];
			rowPercentage['total'] = Math.abs(toolkit.number(rowSalesReturn['total'] / rowGrossSales['total']) * 100);

			var column = {};
			columns.push(column);
			column.title = d._id[key];
			column.field = holder;
			column.width = 170;
			column.attributes = { class: 'align-right' };
			column.headerAttributes = { style: 'text-align: center !important; font-weight: bold;' };
			column.template = function (d) {
				if (d.name == 'Percentage') {
					return kendo.toString(d[holder], 'n2') + ' %';
				}

				return kendo.toString(d[holder], 'n0');
			};
		});
	} else {
		rowGrossSales['total'] = 0;
		rowSalesReturn['total'] = 0;
		rowPercentage['total'] = 0;

		var op1 = _.groupBy(data, function (d) {
			return d._id['_id_' + toolkit.replace(sr.breakdown(), '.', '_')];
		});
		var op2 = _.map(op1, function (v, k) {
			return { key: k, value: v };
		});
		op2.forEach(function (f) {
			var column = {};
			columns.push(column);
			column.title = f.key;
			column.columns = [];
			column.headerAttributes = { style: 'text-align: center !important; font-weight: bold;' };

			f.value.forEach(function (d) {
				var holder = toolkit.replace(d._id[subKey].toLowerCase(), ['.', '/', "'", '"', "\\", "-", ' '], '_');

				rowGrossSales[holder] = d[sr.plGrossSales()];
				rowSalesReturn[holder] = d[sr.plSalesReturn()];
				rowPercentage[holder] = Math.abs(toolkit.number(d[sr.plSalesReturn()] / d[sr.plGrossSales()]) * 100);

				rowGrossSales['total'] += rowGrossSales[holder];
				rowSalesReturn['total'] += rowSalesReturn[holder];
				rowPercentage['total'] = Math.abs(toolkit.number(rowSalesReturn['total'] / rowGrossSales['total']) * 100);

				var subColumn = {};
				column.columns.push(subColumn);
				subColumn.title = d._id[subKey];
				subColumn.width = 170;
				subColumn.attributes = { class: 'align-right' };
				subColumn.headerAttributes = { style: 'text-align: center !important; font-weight: bold;' };
				subColumn.template = function (d) {
					if (d.name == 'Percentage') {
						return kendo.toString(d[holder], 'n2') + ' %';
					}

					return kendo.toString(d[holder], 'n0');
				};
			});

			var totalHolder = 'total_' + toolkit.replace(f.key.toLowerCase(), ['.', '/', "'", '"', "\\", "-", ' '], '_');

			rowGrossSales[totalHolder] = toolkit.sum(f.value, function (d) {
				return d[sr.plGrossSales()];
			});
			rowSalesReturn[totalHolder] = toolkit.sum(f.value, function (d) {
				return d[sr.plSalesReturn()];
			});
			rowPercentage[totalHolder] = Math.abs(toolkit.number(rowSalesReturn[totalHolder] / rowGrossSales[totalHolder]) * 100);

			var subColumnTotal = {};
			column.columns = [subColumnTotal].concat(column.columns);
			column.order = rowGrossSales[totalHolder];
			subColumnTotal.title = 'Total';
			subColumnTotal.field = totalHolder;
			subColumnTotal.width = 170;
			subColumnTotal.attributes = { class: 'align-right' };
			subColumnTotal.headerAttributes = { style: 'text-align: center !important; font-weight: bold;' };
			subColumnTotal.template = function (d) {
				if (d.name == 'Percentage') {
					return kendo.toString(d[totalHolder], 'n2') + ' %';
				}

				return kendo.toString(d[totalHolder], 'n0');
			};
		});

		columns = _.orderBy(columns, function (d) {
			return d.order;
		}, 'desc');
	}

	var dataParsed = [rowGrossSales, rowSalesReturn, rowPercentage];
	console.log("dataParsed", dataParsed);

	var config = {
		dataSource: {
			data: dataParsed
		},
		columns: columns,
		resizable: false,
		sortable: false,
		pageable: false,
		filterable: false,
		dataBound: function dataBound() {
			var sel = '.grid-dashboard .k-grid-content-locked tr, .grid-dashboard .k-grid-content tr';

			$(sel).on('mouseenter', function () {
				var index = $(this).index();
				console.log(this, index);
				var elh = $('.grid-dashboard .k-grid-content-locked tr:eq(' + index + ')').addClass('hover');
				var elc = $('.grid-dashboard .k-grid-content tr:eq(' + index + ')').addClass('hover');
			});
			$(sel).on('mouseleave', function () {
				$('.grid-dashboard tr.hover').removeClass('hover');
			});
		}
	};

	$('.grid').replaceWith('<div class="grid"></div>');
	$('.grid').kendoGrid(config);
};

vm.currentMenu('Analysis');
vm.currentTitle('&nbsp;');
vm.breadcrumb([{ title: 'Godrej', href: viewModel.appName + 'page/landing' }, { title: 'Home', href: viewModel.appName + 'page/landing' }, { title: 'Sales Return Analysis', href: '#' }]);

$(function () {
	rpt.tabbedContent();

	sr.refresh();
});