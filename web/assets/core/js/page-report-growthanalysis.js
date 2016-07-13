"use strict";

viewModel.growth = new Object();
var grw = viewModel.growth;

grw.contentIsLoading = ko.observable(false);

grw.optionBreakdowns = ko.observableArray([{ field: "date.quartertxt", name: "Quarter" }, { field: "date.month", name: "Month" }]);
grw.breakdownBy = ko.observable('date.quartertxt');
grw.breakdownByFiscalYear = ko.observable('date.fiscal');
grw.plNetSales = ko.observable('');
grw.plEBIT = ko.observable('');
grw.columns = ko.observableArray([]);

grw.data = ko.observableArray([]);
grw.fiscalYears = ko.observableArray(rpt.optionFiscalYears());
// grw.level = ko.observable(3)

grw.emptyGrid = function () {
	$('.grid').replaceWith("<div class=\"grid\"></div>");
	$('.chart').replaceWith("<div class=\"chart\"></div>");
};

grw.refresh = function () {
	var useCache = arguments.length <= 0 || arguments[0] === undefined ? false : arguments[0];

	var param = {};
	param.pls = [];
	param.groups = rpt.parseGroups([grw.breakdownByFiscalYear(), grw.breakdownBy()]);
	param.aggr = 'sum';
	param.filters = rpt.getFilterValue(true, grw.fiscalYears);

	grw.contentIsLoading(true);

	var fetch = function fetch() {
		toolkit.ajaxPost(viewModel.appName + "report/getpnldatanew", param, function (res) {
			if (res.Status == "NOK") {
				setTimeout(function () {
					fetch();
				}, 1000 * 5);
				return;
			}

			if (rpt.isEmptyData(res)) {
				grw.contentIsLoading(false);
				return;
			}

			// grw.data(grw.buildStructure(res.Data.Data))
			rpt.plmodels(res.Data.PLModels);
			if (grw.plNetSales() == '') {
				grw.plNetSales('PL8A');
				grw.plEBIT('PL44B');
			}

			grw.emptyGrid();
			grw.contentIsLoading(false);
			grw.renderGrid(res);
			grw.renderChart(res);
		}, function () {
			grw.emptyGrid();
			grw.contentIsLoading(false);
		});
	};

	fetch();
};

grw.reloadLayout = function (d) {
	setTimeout(function () {
		toolkit.try(function () {
			$(d).find('.k-chart').data('kendoChart').redraw();
		});
		toolkit.try(function () {
			$(d).find('.k-grid').data('kendoGrid').refresh();
		});
	}, 100);
};

grw.renderChart = function (res) {
	var data = res.Data.Data.map(function (d) {
		var fiscal = d._id["_id_" + toolkit.replace(grw.breakdownByFiscalYear(), '.', '_')];
		var order = d._id["_id_" + toolkit.replace(grw.breakdownBy(), '.', '_')];
		var sub = d._id["_id_" + toolkit.replace(grw.breakdownBy(), '.', '_')];
		var net = Math.abs(d[grw.plNetSales()]);
		var ebit = Math.abs(d[grw.plEBIT()]);

		if (grw.breakdownBy() == 'date.month') {
			var m = parseInt(sub, 10) - 1 + 3;
			var y = parseInt(fiscal.split('-')[0], 10);
			var mP = moment(new Date(y, m, 1)).format("MMMM");
			var yP = moment(new Date(y, m, 1)).format("YYYY");
			sub = mP + "\n" + yP;
		}

		return {
			fiscal: fiscal,
			sub: sub,
			order: order,
			net: net,
			ebit: ebit
		};
	});

	data = _.orderBy(data, function (d) {
		if (grw.breakdownBy() == 'date.quartertxt') {
			return d.order;
		} else {
			return d.fiscal + " " + (parseInt(d.order) + 10);
		}
	}, 'asc');

	var config = {
		dataSource: { data: data },
		legend: {
			visible: true,
			position: "bottom"
		},
		seriesDefaults: {
			type: "line",
			style: "smooth",
			missingValues: "gap",
			labels: {
				visible: true,
				position: 'top',
				format: '{0:n0}'
			},
			line: {
				border: {
					width: 1,
					color: 'white'
				}
			}
		},
		seriesColors: toolkit.seriesColorsGodrej,
		series: [{
			field: 'net',
			name: function () {
				var row = rpt.plmodels().find(function (d) {
					return d._id == grw.plNetSales();
				});
				if (row != undefined) {
					return row.PLHeader3;
				}

				return '&nbsp;';
			}()
		}, {
			field: 'ebit',
			name: function () {
				var row = rpt.plmodels().find(function (d) {
					return d._id == grw.plEBIT();
				});
				if (row != undefined) {
					return row.PLHeader3;
				}

				return '&nbsp;';
			}()
		}],
		valueAxis: {
			majorGridLines: { color: '#fafafa' },
			labels: {
				font: '"Source Sans Pro" 11px',
				format: "{0:n2}"
			}
		},
		categoryAxis: {
			field: 'sub',
			labels: {
				font: '"Source Sans Pro" 11px',
				format: "{0:n2}"
			},
			majorGridLines: { color: '#fafafa' }
		}
	};

	$('.chart').replaceWith("<div class=\"chart\"></div>");
	if (grw.breakdownBy() == 'date.month') {
		$('.chart').width(data.length * 100);
	}
	$('.chart').kendoChart(config);
};

grw.renderGrid = function (res) {
	var rows = [];
	var rowsAfter = [];
	var columnsPlaceholder = [{
		field: 'pnl',
		title: 'PNL',
		attributes: { class: 'bold' },
		headerAttributes: { style: 'font-weight: bold; vertical-align: middle;' },
		width: 120
	}, {
		field: 'total',
		title: 'Total',
		format: '{0:n0}',
		attributes: { class: 'bold align-right bold' },
		headerAttributes: { style: 'font-weight: bold; vertical-align: middle; text-align: right;' },
		width: 120
	}];

	var columnGrouped = [];
	var data = res.Data.Data;[grw.plNetSales(), grw.plEBIT()].forEach(function (g, rowIndex) {
		var row = {};
		row.pnl = '&nbsp;';
		row.columnData = [];
		row.total = toolkit.sum(data, function (each) {
			return toolkit.number(each[g]);
		});

		var pl = rpt.plmodels().find(function (r) {
			return r._id == g;
		});
		if (pl != undefined) {
			row.pnl = pl.PLHeader3;
		}

		var prev = null;

		var op1 = _.groupBy(data, function (d) {
			return d._id["_id_" + toolkit.replace(grw.breakdownByFiscalYear(), '.', '_')];
		});
		var op9 = _.map(op1, function (v, k) {
			return { key: k, values: v };
		});
		op9.forEach(function (r, j) {
			var k = r.key;
			var v = r.values;
			var op2 = _.groupBy(v, function (d) {
				return d._id["_id_" + toolkit.replace(grw.breakdownBy(), '.', '_')];
			});
			var op3 = _.map(op2, function (w, l) {
				var o = {};

				o.order = l;
				o.key = l;
				o.data = w;

				if (grw.breakdownBy() == 'date.month') {
					o.order = parseInt(o.key, 10);
				}

				return o;
			});
			var op4 = _.orderBy(op3, function (d) {
				return d.order;
			}, 'asc');

			var columnGroup = {};
			columnGroup.title = k;
			columnGroup.headerAttributes = { class: "align-center color-" + j };
			columnGroup.columns = [];

			if (rowIndex == 0) {
				columnGrouped.push(columnGroup);
			}

			op4.forEach(function (d, i) {
				var current = d.data;
				var value = toolkit.sum(current, function (d) {
					return toolkit.number(d[g]);
				});

				var prevValue = 0;
				if (!(j == 0 && i == 0)) {
					prevValue = toolkit.sum(prev, function (d) {
						return toolkit.number(d[g]);
					});
				}

				prev = current;

				var title = d.key;
				if (grw.breakdownBy() == 'date.quartertxt') {
					title = "Quarter " + toolkit.getNumberFromString(d.key.split(' ')[1]);
				} else {
					var m = parseInt(d.key, 10) - 1 + 3;
					var y = parseInt(k.split('-')[0], 10);

					title = moment(new Date(y, m, 1)).format('MMMM YYYY');
				}

				row.columnData.push({
					title: d.key,
					value: value,
					growth: toolkit.number((value - prevValue) / prevValue * 100)
				});

				var left = i + op4.length * j;

				var columnEach = {};
				columnEach.title = title;
				columnEach.headerAttributes = { class: 'align-center' };
				columnEach.columns = [];

				columnGroup.columns.push(columnEach);

				var columnValue = {};
				columnValue.title = 'Value';
				columnValue.field = "columnData[" + left + "].value";
				columnValue.width = 120;
				columnValue.format = '{0:n0}';
				columnValue.attributes = { class: 'align-right' };
				columnValue.headerAttributes = { class: "align-center" }; // color-${j}` }
				columnEach.columns.push(columnValue);

				var columnGrowth = {};
				columnGrowth.title = 'Growth %';
				columnGrowth.width = 70;
				columnGrowth.template = function (d) {
					return kendo.toString(d.columnData[left].growth, 'n2') + " %";
				};
				columnGrowth.headerAttributes = { class: 'align-center', style: 'font-style: italic;' };
				columnGrowth.attributes = { class: 'align-right' };
				columnEach.columns.push(columnGrowth);
			});
		});

		rowsAfter.push(row);
	});

	if (columnGrouped.length > 0) {
		columnsPlaceholder[0].locked = true;
		columnsPlaceholder[1].locked = true;
	}

	columnGrouped = _.orderBy(columnGrouped, function (d) {
		return d.title;
	}, 'asc');

	grw.data(rowsAfter);
	grw.columns(columnsPlaceholder.concat(columnGrouped));

	var config = {
		dataSource: {
			data: grw.data()
		},
		columns: grw.columns(),
		resizable: false,
		sortable: false,
		pageable: false,
		filterable: false,
		dataBound: function dataBound() {
			var sel = '.grid-dashboard .k-grid-content-locked tr, .grid-dashboard .k-grid-content tr';

			$(sel).on('mouseenter', function () {
				var index = $(this).index();
				console.log(this, index);
				var elh = $(".grid-dashboard .k-grid-content-locked tr:eq(" + index + ")").addClass('hover');
				var elc = $(".grid-dashboard .k-grid-content tr:eq(" + index + ")").addClass('hover');
			});
			$(sel).on('mouseleave', function () {
				$('.grid-dashboard tr.hover').removeClass('hover');
			});
		}
	};

	$('.grid').kendoGrid(config);
};

viewModel.annualGrowth = new Object();
var ag = viewModel.annualGrowth;

ag.optionBreakdowns = ko.observableArray([{ "field": "customer.branchname", "name": "Branch/RD", "title": "customer_branchname" }, { "field": "product.brand", "name": "Brand", "title": "product_brand" }, { "field": "customer.channelname", "name": "Channel", "title": "customer_channelname" }, { "field": "customer.areaname", "name": "City", "title": "customer_areaname" }, { "field": "customer.region", "name": "Region", "title": "customer_region" }, { "field": "customer.zone", "name": "Zone", "title": "customer_zone" }, { "field": "customer.keyaccount", "name": "Customer Group", "title": "customer_keyaccount" }]);
ag.contentIsLoading = ko.observable(false);
ag.breakdownBy = ko.observable('customer.channelname');
ag.optionPercentageValue = ko.observableArray([{ _id: "value", name: "Value" }, { _id: "percentage", name: "Percentage" }]);
ag.series1PL = ko.observable('');
ag.series1Type = ko.observable('value');
ag.series2PL = ko.observable('');
ag.series2Type = ko.observable('value'); // value
ag.limit = ko.observable(6);
ag.data = ko.observableArray([]);

ag.getPLModels = function (c) {
	app.ajaxPost(viewModel.appName + "report/getplmodel", {}, function (res) {
		rpt.plmodels(_.orderBy(res, function (d) {
			return d.OrderIndex;
		}));

		ag.series1PL('PL8A');
		ag.series2PL('PL44B'); // PL44B
		ag.refresh();
	});
};

ag.refresh = function () {
	var param = {};
	param.pls = [ag.series1PL(), ag.series2PL()];
	param.groups = rpt.parseGroups([ag.breakdownBy()]);
	param.aggr = 'sum';
	param.filters = rpt.getFilterValue(true, ko.observableArray(rpt.optionFiscalYears()));

	var fetch = function fetch() {
		toolkit.ajaxPost(viewModel.appName + "report/getpnldatanew", param, function (res) {
			if (res.Status == "NOK") {
				setTimeout(function () {
					fetch();
				}, 1000 * 5);
				return;
			}

			if (rpt.isEmptyData(res)) {
				ag.contentIsLoading(false);
				return;
			}

			ag.contentIsLoading(false);
			ag.data(res.Data.Data);
			ag.render();
		}, function () {
			ag.contentIsLoading(false);
		});
	};

	ag.contentIsLoading(true);
	fetch();
};

ag.render = function () {
	var billion = 1000000000;
	var op1 = _.groupBy(ag.data(), function (d) {
		return d._id["_id_" + toolkit.replace(ag.breakdownBy(), '.', '_')];
	});
	var op2 = _.map(op1, function (v, k) {
		v = _.orderBy(v, function (e) {
			return e._id._id_date_fiscal;
		}, 'asc');

		var o = {};
		o.breakdown = k;
		o.series1 = 0;
		o.series2 = 0;

		toolkit.try(function () {
			if (ag.series1Type() == 'percentage') {
				o.series1 = (v[1][ag.series1PL()] - v[0][ag.series1PL()]) / v[0][ag.series1PL()] * 100;
			} else {
				o.series1 = (v[1][ag.series1PL()] - v[0][ag.series1PL()]) / billion;
			}
		});

		toolkit.try(function () {
			if (ag.series2Type() == 'percentage') {
				o.series2 = (v[1][ag.series2PL()] - v[0][ag.series2PL()]) / v[0][ag.series2PL()] * 100;
			} else {
				o.series2 = (v[1][ag.series2PL()] - v[0][ag.series2PL()]) / billion;
			}
		});

		return o;
	});
	var op3 = _.orderBy(op2, function (d) {
		var hack = parseInt('10 000 000 000 000'.replace(/\ /g, ''), 10);

		if (ag.breakdownBy() == 'customer.channelname') {
			var order = ag.getChannelOrderByChannelName(d.breakdown);
			if (order > -1) {
				return hack - order;
			}
		} else if (ag.breakdownBy() == 'product.brand') {
			var _order = ag.getBrandOrderByBrand(d.breakdown);
			if (_order > -1) {
				return hack - _order;
			}
		}

		return d.series1;
	}, 'desc');
	var op4 = _.take(op3, ag.limit());

	var width = $('#tab1').width();
	if (_.min([ag.limit(), op4.length]) > 6) {
		width = 160 * ag.limit();
	}
	if (width == $('#tab1').width()) {
		width = width - 22 + "px";
	}

	var series = [{
		field: 'series1',
		name: function () {
			var row = rpt.plmodels().find(function (d) {
				return d._id == ag.series1PL();
			});
			if (row != undefined) {
				return row.PLHeader3 + " " + ag.series1Type();
			}

			return '&nbsp;';
		}(),
		axis: ag.series1Type(),
		color: toolkit.seriesColorsGodrej[0]
	}, {
		field: 'series2',
		name: function () {
			var row = rpt.plmodels().find(function (d) {
				return d._id == ag.series2PL();
			});
			if (row != undefined) {
				return row.PLHeader3 + " " + ag.series2Type();
			}

			return '&nbsp;';
		}(),
		axis: ag.series2Type(),
		color: toolkit.seriesColorsGodrej[1]
	}];

	var axes = [{
		name: ag.series1Type(),
		majorGridLines: { color: '#fafafa' },
		labels: {
			font: '"Source Sans Pro" 11px',
			format: "{0:n2}"
		}
	}];

	var categoryAxis = {
		field: 'breakdown',
		labels: {
			font: '"Source Sans Pro" 11px',
			format: "{0:n2}"
		},
		majorGridLines: { color: '#fafafa' }
	};

	if (ag.series1Type() != ag.series2Type()) {
		axes.push({
			name: ag.series2Type(),
			majorGridLines: { color: '#fafafa' },
			labels: {
				font: '"Source Sans Pro" 11px',
				format: "{0:n2}"
			}
		});
	}

	if (axes.length > 1) {
		categoryAxis.axisCrossingValue = [0, op4.length];

		axes.forEach(function (d, i) {
			d.color = toolkit.seriesColorsGodrej[i];

			var orig = _.max(op4.map(function (f) {
				return Math.abs(f["series" + (i + 1)]);
			}));
			var max = Math.pow(10, String(parseInt(orig, 10)).length - 1) * (parseInt(String(parseInt(orig, 10))[0], 10) + 1);

			d.min = max * -1;
			d.max = max;

			if (ag["series" + (i + 1) + "Type"]() == 'percentage') {
				d.labels.format = "{0:n1} %";
			} else {
				d.labels.format = "{0:n1} B";
			}

			console.log('---', orig, max, d);
		});
	}

	series.forEach(function (d, i) {
		d.tooltip = {
			visible: true,
			template: function template(e) {
				var value = kendo.toString(e.value, 'n1') + " B";

				if (ag["series" + (i + 1) + "Type"]() == 'percentage') {
					value = kendo.toString(e.value, 'n1') + " %";
				}

				return d.name + ": " + value;
			}
		};

		d.labels = {
			visible: true
		};

		if (ag["series" + (i + 1) + "Type"]() == 'percentage') {
			d.labels.format = '{0:n1} %';
		} else {
			d.labels.format = '{0:n1} B';
		}
	});

	var config = {
		dataSource: { data: op4 },
		legend: {
			visible: true,
			position: "bottom"
		},
		seriesDefaults: {
			type: "column",
			style: "smooth",
			missingValues: "gap",
			line: {
				border: {
					width: 1,
					color: 'white'
				}
			},
			overlay: { gradient: 'none' },
			border: { width: 0 }
		},
		series: series,
		valueAxis: axes,
		categoryAxis: categoryAxis
	};

	$('.annually-diff').replaceWith("<div class=\"annually-diff\" style=\"width: " + width + "px;\"></div>");
	$('.annually-diff').kendoChart(config);
};

ag.getChannelOrderByChannelName = function (channelname) {
	// MT, GT, RD, INDUSTRIAL, MOTORIST, EXPORT
	switch (channelname.toLowerCase()) {
		case 'modern trade':case 'mt':
			return 0;break;
		case 'general trade':case 'gt':
			return 1;break;
		case 'regional distributor':case 'rd':
			return 2;break;
		case 'industrial trade':case 'industrial':case 'it':
			return 3;break;
		case 'motorist':
			return 4;break;
		case 'export':
			return 5;break;
	}

	return -1;
};

ag.getBrandOrderByBrand = function (brandname) {
	// HIT, STELLA, MITU, other
	switch (brandname.toLowerCase()) {
		case 'hit':
			return 0;break;
		case 'stella':
			return 1;break;
		case 'mitu':
			return 2;break;
	}

	return -1;
};

vm.currentMenu('Analysis');
vm.currentTitle('&nbsp;');
vm.breadcrumb([{ title: 'Godrej', href: viewModel.appName + 'page/landing' }, { title: 'Home', href: viewModel.appName + 'page/landing' }, { title: 'Growth Analysis', href: '#' }]);

$(function () {
	grw.refresh();
	ag.getPLModels();
});