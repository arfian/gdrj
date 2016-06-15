'use strict';

vm.currentMenu('Dashboard');
vm.currentTitle("Dashboard");
vm.breadcrumb([{ title: 'Godrej', href: '#' }, { title: 'Dashboard', href: '/report/dashboard' }]);

viewModel.dashboard = {};
var dsbrd = viewModel.dashboard;

dsbrd.dimension = ko.observable('customer.channelname');
dsbrd.fiscalYear = ko.observable(2014);
dsbrd.contentIsLoading = ko.observable(false);

dsbrd.data = ko.observableArray([{ pnl: 'Gross Sales', q1: 1000000, q2: 1150000, q3: 1280000, q4: 1400000, type: 'number' }, { pnl: 'Growth', q1: 0, q2: 15, q3: 11, q4: 9, type: 'percentage' }, { pnl: 'Discount', q1: 0, q2: 15, q3: 11, q4: 9, type: 'percentage' }, { pnl: 'ATL', q1: 0, q2: 15, q3: 11, q4: 9, type: 'percentage' }, { pnl: 'BTL', q1: 0, q2: 15, q3: 11, q4: 9, type: 'percentage' }, { pnl: 'COGS', q1: 0, q2: 15, q3: 11, q4: 9, type: 'percentage' }, { pnl: 'Gross Margin', q1: 0, q2: 15, q3: 11, q4: 9, type: 'percentage' }, { pnl: 'SGA', q1: 0, q2: 15, q3: 11, q4: 9, type: 'percentage' }, { pnl: 'Royalties', q1: 0, q2: 15, q3: 11, q4: 9, type: 'percentage' }, { pnl: 'EBITDA', q1: 0, q2: 15, q3: 11, q4: 9, type: 'percentage' }, { pnl: 'EBIT (%)', q1: 10, q2: 10, q3: 10, q4: 10, type: 'percentage' }, { pnl: 'EBIT', q1: 100000, q2: 115000, q3: 128000, q4: 140000, type: 'number' }]);

dsbrd.render = function () {
	var columns = [{ field: 'pnl', title: 'PNL', attributes: { class: 'bold' } }];

	toolkit.repeat(4, function (i) {
		columns.push({
			// field: `q${i + 1}`,
			title: 'Quarter ' + (i + 1),
			template: function template(d) {
				var value = kendo.toString(d['q' + (i + 1)], 'n0');
				if (d.type == 'percentage') {
					value = value + ' %';
				}
				return value;
			},
			// headerTemplate: `<div class="align-right bold">Quarter ${(i + 1)}</div>`,
			attributes: { class: 'align-right' },
			headerAttributes: { style: 'text-align: right !important;', class: 'bold' },
			format: '{0:n0}'
		});
	});

	var config = {
		dataSource: {
			data: dsbrd.data(),
			schema: {
				model: {
					fields: {
						q1: { type: "number" },
						q2: { type: "number" },
						q3: { type: "number" },
						q4: { type: "number" }
					}
				}
			}
		},
		columns: columns,
		resizabl: false,
		sortable: true,
		pageable: false,
		filterable: false
	};

	$('.grid-dashboard').replaceWith('<div class="grid-dashboard"></div>');
	$('.grid-dashboard').kendoGrid(config);
};

dsbrd.refresh = function () {
	dsbrd.render();
};

viewModel.dashboardRanking = {};
var rank = viewModel.dashboardRanking;

rank.dimension = ko.observable('product.brand');
rank.columns = ko.observableArray([{ field: 'gm', name: 'GM %', type: 'percentage' }, { field: 'cogs', name: 'COGS %', type: 'percentage' }, { field: 'ebit_p', name: 'EBIT %', type: 'percentage' }, { field: 'ebitda', name: 'EBITDA %', type: 'percentage' }, { field: 'net_sales', name: 'Net Sales', type: 'number' }, { field: 'ebit', name: 'EBIT', type: 'number' }]);
rank.contentIsLoading = ko.observable(false);

rank.data = ko.observableArray([{ product_brand: 'Mitu', gm: 30, cogs: 70, ebit_p: 9.25, ebitda: 92500, net_sales: 1000000, ebit: 92500 }, { product_brand: 'Stella', gm: 29, cogs: 71, ebit_p: 9, ebitda: 99000, net_sales: 1100000, ebit: 99000 }, { product_brand: 'Hit', gm: 27, cogs: 73, ebit_p: 8, ebitda: 96000, net_sales: 1200000, ebit: 96000 }, { product_brand: 'Etc', gm: 26, cogs: 74, ebit_p: 7, ebitda: 91000, net_sales: 1300000, ebit: 91000 }]);

rank.render = function () {
	var columns = [{
		field: toolkit.replace(rank.dimension(), ".", "_"),
		title: 'PNL',
		attributes: { class: 'bold' }
	}];

	rank.columns().forEach(function (e) {
		var column = {
			field: e.field,
			title: e.name,
			// headerTemplate: `<div class="align-right bold">${e.name}</div>`,
			attributes: { class: 'align-right' },
			headerAttributes: { style: 'text-align: right !important;', class: 'bold' },
			format: '{0:n2}'
		};

		columns.push(column);
	});

	var config = {
		dataSource: {
			data: rank.data()
		},
		columns: columns,
		resizabl: false,
		sortable: true,
		pageable: false,
		filterable: false
	};

	$('.grid-ranking').replaceWith('<div class="grid-ranking"></div>');
	$('.grid-ranking').kendoGrid(config);
};

rank.refresh = function () {
	rank.render();
};

viewModel.salesDistribution = {};
var sd = viewModel.salesDistribution;

sd.breakdown = ko.observable('customer.channelname');
sd.data = ko.observableArray([{ customer_channelname: "modern trade", group: "hyper", percentage: 8, value: 240000 }, { customer_channelname: "modern trade", group: "super", percentage: 12, value: 360000 }, { customer_channelname: "modern trade", group: "mini", percentage: 10, value: 300000 }, { customer_channelname: "general trade", group: "type 1", percentage: 3, value: 90000 }, { customer_channelname: "general trade", group: "type 2", percentage: 4, value: 120000 }, { customer_channelname: "general trade", group: "type 3", percentage: 5, value: 150000 }, { customer_channelname: "general trade", group: "type 4", percentage: 4, value: 120000 }, { customer_channelname: "general trade", group: "type 5", percentage: 2, value: 60000 }, { customer_channelname: "general trade", group: "type 6", percentage: 6, value: 180000 }, { customer_channelname: "general trade", group: "type 7", percentage: 5, value: 150000 }, { customer_channelname: "general trade", group: "type 8", percentage: 5, value: 150000 }, { customer_channelname: "general trade", group: "type 9", percentage: 6, value: 180000 }, { customer_channelname: "retail distribution", group: "", percentage: 30, value: 900000 }]);
sd.render = function () {
	var dimension = toolkit.replace(sd.breakdown(), ".", "_");
	var total = toolkit.sum(sd.data(), function (d) {
		return d.value;
	});
	var op1 = _.groupBy(sd.data(), function (d) {
		return d[dimension];
	});
	var op2 = _.map(op1, function (v, k) {
		return { key: k, values: v };
	});
	var maxRow = _.maxBy(op2, function (d) {
		return d.values.length;
	});
	var maxRowIndex = op2.indexOf(maxRow);
	var height = 20 * maxRow.values.length;
	var width = 200;

	var container = $('.grid-sales-dist');
	var table = toolkit.newEl('table').appendTo(container).height(height);
	var tr1st = toolkit.newEl('tr').appendTo(table);
	var tr2nd = toolkit.newEl('tr').appendTo(table);

	op2.forEach(function (d) {
		var td1st = toolkit.newEl('td').appendTo(tr1st).width(width);
		var sumPercentage = _.sumBy(d.values, function (e) {
			return e.percentage;
		});
		td1st.html(d.key + '<br />' + sumPercentage + ' %');

		var td2nd = toolkit.newEl('td').appendTo(tr2nd);

		var innerTable = toolkit.newEl('table').appendTo(td2nd);

		if (d.values.length == 1) {
			var tr = toolkit.newEl('tr').appendTo(innerTable);
			toolkit.newEl('td').appendTo(tr).html(kendo.toString(d.values[0].value, 'n0')).height(height).addClass('single');
			return;
		}

		d.values.forEach(function (e) {
			var tr = toolkit.newEl('tr').appendTo(innerTable);
			toolkit.newEl('td').appendTo(tr).html(e[dimension]).height(height / d.values.length);
			toolkit.newEl('td').appendTo(tr).html(e.percentage + ' %');
			toolkit.newEl('td').appendTo(tr).html(kendo.toString(e.value, 'n0'));
		});
	});

	var trTotal = toolkit.newEl('tr').appendTo(table);
	var tdTotal = toolkit.newEl('td').addClass('align-center total').attr('colspan', op2.length).appendTo(trTotal).html(kendo.toString(total, 'n0'));
};
sd.refresh = function () {
	sd.render();
};

$(function () {
	dsbrd.refresh();
	rank.refresh();
	sd.refresh();
});