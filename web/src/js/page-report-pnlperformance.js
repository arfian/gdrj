viewModel.breakdown = new Object()
let bkd = viewModel.breakdown

bkd.contentIsLoading = ko.observable(false)
bkd.popupIsLoading = ko.observable(false)
bkd.title = ko.observable('P&L Analytic')
bkd.detail = ko.observableArray([])
bkd.limit = ko.observable(10)
bkd.breakdownNote = ko.observable('')

bkd.breakdownBy = ko.observable('customer.channelname')
bkd.breakdownByFiscalYear = ko.observable('date.fiscal')
bkd.oldBreakdownBy = ko.observable(bkd.breakdownBy())

bkd.data = ko.observableArray([])
bkd.fiscalYear = ko.observable(rpt.value.FiscalYear())
bkd.breakdownValue = ko.observableArray([])
bkd.level = ko.observable(1)
bkd.isBreakdownBranch = ko.observable(false)

bkd.breakdownBranch_Channels = ko.observableArray([])
bkd.breakdownBranch_ChannelRDNonRD = ko.observable('')
bkd.breakdownBranch_SubChannel = ko.observable('')

bkd.changeTo = (d, title) => {
	if (d == 'summary') {
		setTimeout(() => {
			$('#summary').find('.k-grid').each((i, e) => {
				$(e).data('kendoGrid').refresh()
			})
			$('#summary').find('.k-chart').each((i, e) => {
				$(e).data('kendoChart').redraw()
			})
		}, 300)
		return
	}

	bkd.breakdownBy(d)
	bkd.title(title)
	bkd.refresh()
}

bkd.isBreakdownBranchSubEnabled = (d) => ko.computed(() => {
	if (d == 'channel') {
		if (bkd.breakdownBranch_ChannelRDNonRD() != '') {
			return false
		} else

		if (bkd.breakdownBranch_SubChannel() != '') {
			return false
		}

		return true
	} else

	if (d == 'rd-non-rd') {
		if (bkd.breakdownBranch_Channels().length > 0) {
			return false
		} else

		if (bkd.breakdownBranch_SubChannel() != '') {
			return false
		}

		return true
	} else

	if (d == 'sub-channel') {
		if (bkd.breakdownBranch_Channels() != '') {
			return false
		} else

		if (bkd.breakdownBranch_ChannelRDNonRD() != '') {
			return false
		}

		return true
	}

	return true
}, bkd)

bkd.breakdownChannel = ko.observable('')
bkd.breakdownChannels = ko.observableArray([])

bkd.optionBreakdownRDNonRD = ko.observableArray([
	{ _id: "All", Name: "RD & Non RD" },
	{ _id: "RD", Name: "Only RD Sales" },
	{ _id: "NonRD", Name: "Non RD Sales" },
])

bkd.isBreakdownChannel = ko.observable(false)
bkd.breakdownChannelLocation = ko.observable('')
bkd.optionBreakdownChannelLocations = ko.observableArray([
	{ _id: "zone", Name: "Zone" },
	{ _id: "region", Name: "Region" },
	{ _id: "areaname", Name: "City" },
])

bkd.refresh = (useCache = false) => {
	if (bkd.breakdownValue().length == 0) {
		toolkit.showError('Please choose at least breakdown value')
		return
	}

	let param = {}
	param.pls = []
	param.groups = rpt.parseGroups([bkd.breakdownBy()])
	param.aggr = 'sum'
	param.filters = rpt.getFilterValue(false, bkd.fiscalYear)

	let breakdownValue = bkd.breakdownValue().filter((d) => d != 'All')
	if (breakdownValue.length > 0) {
		param.filters.push({
			Field: bkd.breakdownBy(),
			Op: '$in',
			Value: bkd.breakdownValue()
		})
	}

	if (bkd.breakdownChannels().length > 0) {
		param.groups.push('customer.reportsubchannel')
		param.filters.push({
			Field: 'customer.channelname',
			Op: '$in',
			Value: bkd.breakdownChannels()
		})

		bkd.level(2)
	}

	if (bkd.breakdownChannelLocation() != '') {
		param.groups.push(`customer.${bkd.breakdownChannelLocation()}`)
		bkd.level(2)
	}

	// ====== BREAKDOWN BY BRANCH - CHANNEL

	if (bkd.breakdownBy() == 'customer.branchname') {
		if (bkd.breakdownBranch_Channels().length > 0) {
			param.groups.push('customer.channelname')
			param.filters.push({
				Field: 'customer.channelname',
				Op: '$in',
				Value: bkd.breakdownBranch_Channels()
			})
		} else

		if (bkd.breakdownBranch_ChannelRDNonRD() != '') {
			let values = []

			switch (bkd.breakdownBranch_ChannelRDNonRD()) {
				case 'All':
					values = []
				break;
				case 'RD':
					values = ['I1']
				break;
				case 'NonRD':
					values = rpt.masterData.Channel().map((d) => d._id)
						.filter((d) => d != 'I1')
				break;
			}

			param.groups.push('customer.channelname')

			if (values.length > 0) {
				param.filters.push({
					Field: 'customer.channelname',
					Op: '$in',
					Value: values
				})
			}
		} else 

		if (bkd.breakdownBranch_SubChannel() != '') {
			param.groups.push('customer.reportsubchannel')
			param.filters.push({
				Field: 'customer.channelname',
				Op: '$in',
				Value: [bkd.breakdownBranch_SubChannel()]
			})
		}
	}

	bkd.oldBreakdownBy(bkd.breakdownBy())
	bkd.contentIsLoading(true)

	let fetch = () => {
		toolkit.ajaxPost(viewModel.appName + "report/getpnldatanew", param, (res) => {
			if (res.Status == "NOK") {
				setTimeout(() => {
					fetch()
				}, 1000 * 5)
				return
			}

			if (rpt.isEmptyData(res)) {
				bkd.contentIsLoading(false)
				return
			}

			let date = moment(res.time).format("dddd, DD MMMM YYYY HH:mm:ss")
			bkd.breakdownNote(`Last refreshed on: ${date}`)

			let data = bkd.buildStructure(res.Data.Data)
			bkd.data(data)
			rpt.plmodels(res.Data.PLModels)
			bkd.emptyGrid()
			bkd.contentIsLoading(false)
			bkd.render()
		}, () => {
			bkd.emptyGrid()
			bkd.contentIsLoading(false)
		}, {
			cache: (useCache == true) ? 'breakdown chart' : false
		})
	}

	fetch()
}

bkd.clickExpand = (e) => {
	let right = $(e).find('i.fa-chevron-right').length
	let down = $(e).find('i.fa-chevron-down').length
	if (right > 0){
		if (['PL28', 'PL29A', 'PL31'].indexOf($(e).attr('idheaderpl')) > -1) {
			$('.pivot-pnl .table-header').css('width', '530px')
			$('.pivot-pnl .table-content').css('margin-left', '530px')
		}

		$(e).find('i').removeClass('fa-chevron-right')
		$(e).find('i').addClass('fa-chevron-down')
		$(`tr[idparent=${e.attr('idheaderpl')}]`).css('display', '')
		$(`tr[idcontparent=${e.attr('idheaderpl')}]`).css('display', '')
		$(`tr[statusvaltemp=hide]`).css('display', 'none')
		rpt.refreshHeight(e.attr('idheaderpl'))
	}
	if (down > 0) {
		if (['PL28', 'PL29A', 'PL31'].indexOf($(e).attr('idheaderpl')) > -1) {
			$('.pivot-pnl .table-header').css('width', '')
			$('.pivot-pnl .table-content').css('margin-left', '')
		}
		
		$(e).find('i').removeClass('fa-chevron-down')
		$(e).find('i').addClass('fa-chevron-right')
		$(`tr[idparent=${e.attr('idheaderpl')}]`).css('display', 'none')
		$(`tr[idcontparent=${e.attr('idheaderpl')}]`).css('display', 'none')
		rpt.hideAllChild(e.attr('idheaderpl'))
	}
}

bkd.emptyGrid = () => {
	$('.breakdown-view').replaceWith(`<div class="breakdown-view ez" id="pnl-analysis"></div>`)
}

bkd.renderDetailSalesTrans = (breakdown) => {
	bkd.popupIsLoading(true)
	$('#modal-detail-ledger-summary').appendTo($('body'))
	$('#modal-detail-ledger-summary').modal('show')

	let columns = [
		// { field: '_id', title: 'ID', width: 100, locked: true },
		{ field: 'date', title: 'Date', width: 150, locked: true, template: (d) => {
			return moment(d.date).format('DD/MM/YYYY HH:mm')
		} },
		{ field: "grossamount", headerTemplate: '<div class="align-right">Gross</div>', width: 100, format: '{0:n0}', attributes: { class: 'align-right' } },
		{ field: "discountamount", headerTemplate: '<div class="align-right">Discount</div>', width: 100, format: '{0:n0}', attributes: { class: 'align-right' } },
		{ field: "netamount", headerTemplate: '<div class="align-right">Net Sales</div>', width: 100, format: '{0:n0}', attributes: { class: 'align-right' } },
		{ field: "salesqty", headerTemplate: '<div class="align-right">Sales Qty</div>', width: 100, format: '{0:n0}', attributes: { class: 'align-right' } },
		{ field: "customer.branchname", title: 'Branch', width: 100 },
		{ field: "product.name", title: 'Product', width: 250 },
		{ field: "product.brand", title: 'Brand', width: 100 },
	]

	let config = {
		dataSource: {
			transport: {
			    read: (options) => {
			    	let param = options.data
			    	param.tablename = "browsesalestrxs"
			    	param[bkd.breakdownBy()] = [breakdown]

			    	if (toolkit.isUndefined(param.page)) {
			    		param = $.extend(true, param, {
			    			take: 5,
			    			skip: 0,
			    			page: 1,
			    			pageSize: 5	
			    		})
			    	}

		            $.ajax({
		                type: "POST",
						url: "/databrowser/getdatabrowser",
		                contentType: "application/json; charset=utf-8",
		                dataType: 'json',
		                data: JSON.stringify(param),
		                success: (res) => {
							bkd.popupIsLoading(false)
							setTimeout(() => {
								options.success(res.data)
							}, 200)
		                },
		                error: () => {
							bkd.popupIsLoading(false)
		                }
		            });
		        },
		        pageSize: 5
			},
			schema: {
			    data: (d) => d.DataValue,
			    total: (d) => d.DataCount
			},
			serverPaging: true,
			columns: [],
			pageSize: 5,
		},
		sortable: true,
        pageable: true,
        scrollable: true,
		columns: columns,
	}

	$('.grid-detail').replaceWith('<div class="grid-detail"></div>')
	$('.grid-detail').kendoGrid(config)
}

bkd.renderDetail = (plcode, breakdowns) => {
	bkd.popupIsLoading(true)
	$('#modal-detail-ledger-summary .modal-title').html('Detail')
	$('#modal-detail-ledger-summary').appendTo($('body'))
	$('#modal-detail-ledger-summary').modal('show')

	let titleParts = []
	for (let p in breakdowns) {
		if (breakdowns.hasOwnProperty(p)) {
			titleParts.push(breakdowns[p])
		}
	}

	$('#modal-detail-ledger-summary .modal-title').html(`Detail of ${titleParts.join(' ')}`)

	let columns = [
		{ title: 'Date', width: 120, locked: true, footerTemplate: 'Total :', template: (d) => moment(d.date.date).format('DD/MM/YYYY HH:mm'), attributes: { class: 'bold' } },
		// { field: `pldatas.${plcode}.amount`, width: 120, aggregates: ["sum"], headerTemplate: "<div class='align-right'>Amount</div>", footerTemplate: (d) => d[`pldatas.${plcode}.amount`].sum, format: '{0:n2}', attributes: { class: 'align-right' } },
		{ field: 'grossamount', width: 90, aggregates: ["sum"], headerTemplate: "<div class='align-right'>Gross</div>", /** footerTemplate: (d) => `<div class="align-right">${kendo.toString(d.grossamount.sum, 'n0')}</div>`,  */ format: '{0:n2}', attributes: { class: 'align-right' } },
		{ field: 'discountamount', width: 90, aggregates: ["sum"], headerTemplate: "<div class='align-right'>Discount</div>", /** footerTemplate: (d) => `<div class="align-right">${kendo.toString(d.discountamount.sum, 'n0')}</div>`,  */ format: '{0:n2}', attributes: { class: 'align-right' } },
		{ field: 'netamount', width: 90, aggregates: ["sum"], headerTemplate: "<div class='align-right'>Net Sales</div>", /** footerTemplate: (d) => `<div class="align-right">${kendo.toString(d.netamount.sum, 'n0')}</div>`,  */ format: '{0:n2}', attributes: { class: 'align-right' } },
		// { title: 'Cost Center', template: (d) => toolkit.redefine(toolkit.redefine(d.cc, {}).name, ''), width: 250 },
		{ title: 'Outlet', template: (d) => toolkit.redefine(toolkit.redefine(d.customer, {}).name, ''), width: 200 },
		{ title: 'Branch', template: (d) => toolkit.redefine(toolkit.redefine(d.customer, {}).branchname, ''), width: 150 },
		{ title: 'Channel', template: (d) => toolkit.redefine(toolkit.redefine(d.customer, {}).channelname, ''), width: 150 },
		{ title: 'Brand', template: (d) => toolkit.redefine(toolkit.redefine(d.product, {}).brand, ''), width: 100 },
		{ title: 'Product', template: (d) => toolkit.redefine(toolkit.redefine(d.product, {}).name, ''), width: 250 },
	]

	let config = {
		dataSource: {
			transport: {
			    read: (options) => {
			    	let param = options.data
			    	param.filters = []

					for (let p in breakdowns) {
						if (breakdowns.hasOwnProperty(p)) {
							param.filters.push({
								field: p.replace(/_id_/g, '').replace(/_/g, '.'),
								op: "$eq",
								value: breakdowns[p]
							})
						}
					}

			    	if (toolkit.isUndefined(param.page)) {
			    		param = $.extend(true, param, {
			    			take: 5,
			    			skip: 0,
			    			page: 1,
			    			pageSize: 5	
			    		})
			    	}

		            $.ajax({
		                type: "POST",
						url: "/report/getpnldetail",
		                contentType: "application/json; charset=utf-8",
		                dataType: 'json',
		                data: JSON.stringify(param),
		                success: (res) => {
							bkd.popupIsLoading(false)
							setTimeout(() => {
								console.log("++++", res)
								options.success(res.Data)
							}, 200)
		                },
		                error: () => {
							bkd.popupIsLoading(false)
		                }
		            });
		        },
		        pageSize: 5
			},
			schema: {
			    data: (d) => d.DataValue,
			    total: (d) => d.DataCount
			},
	  //       aggregates: [
			// 	{ field: "netamount", aggregate: "sum" },
			// 	{ field: "grossamount", aggregate: "sum" },
			// 	{ field: "discountamount", aggregate: "sum" },
			// 	{ field: `pldatas.${plcode}.amount`, aggregate: 'sum' }
			// ],
			serverPaging: true,
			pageSize: 5,
		},
		sortable: true,
        pageable: true,
        scrollable: true,
		columns: columns,
		dataBound: (d) => {
			$('.grid-detail .k-pager-nav.k-pager-last').hide()
			
			setTimeout(() => {
				let pager = $('.grid-detail .k-pager-info')
				let text = `rows ${pager.html().split(" ").slice(0, 3).join(" ")}`
				pager.html(text)
			}, 10)
		}
	}

	console.log("======", config)

	$('.grid-detail').replaceWith('<div class="grid-detail"></div>')
	$('.grid-detail').kendoGrid(config)
}

bkd.buildStructure = (data) => {
	let groupThenMap = (data, group) => {
		let op1 = _.groupBy(data, (d) => group(d))
		let op2 = _.map(op1, (v, k) => {
			let key = { _id: k, subs: v }
			let sample = v[0]

			for (let prop in sample) {
				if (sample.hasOwnProperty(prop) && prop != '_id') {
					key[prop] = toolkit.sum(v, (d) => d[prop])
				}
			}

			return key
		})

		return op2
	}

	if (bkd.breakdownChannels().length > 0) {
		let parsed = groupThenMap(data, (d) => {
			return d._id[`_id_${toolkit.replace(bkd.breakdownBy(), '.', '_')}`]
		}).map((d) => {
			let subs = groupThenMap(d.subs, (e) => {
				return e._id._id_customer_reportsubchannel
			}).map((e) => {
				e.breakdowns = e.subs[0]._id
				d.count = 1
				return e
			})

			d.subs = _.orderBy(subs, (e) => e.PL8A, 'desc')
			d.breakdowns = d.subs[0]._id
			d.count = d.subs.length
			return d
		})
	
		bkd.level(2)
		let newParsed = _.orderBy(parsed, (d) => d.PL8A, 'desc')
		return newParsed
	}

	if (bkd.breakdownChannelLocation() != '') {
		let parsed = groupThenMap(data, (d) => {
			return d._id[`_id_${toolkit.replace(bkd.breakdownBy(), '.', '_')}`]
		}).map((d) => {
			let subs = groupThenMap(d.subs, (e) => {
				return e._id[`_id_customer_${bkd.breakdownChannelLocation()}`]
			}).map((e) => {
				e.breakdowns = e.subs[0]._id
				d.count = 1
				return e
			})

			d.subs = _.orderBy(subs, (e) => e.PL8A, 'desc')
			d.breakdowns = d.subs[0]._id
			d.count = d.subs.length
			return d
		})
	
		bkd.level(2)
		let newParsed = _.orderBy(parsed, (d) => d.PL8A, 'desc')
		return newParsed
	}

	if (bkd.breakdownBy() == 'customer.branchname') {
		if (bkd.breakdownBranch_Channels().length > 0) {
			let parsed = groupThenMap(data, (d) => {
				return d._id[`_id_customer_branchname`]
			}).map((d) => {
				let subs = groupThenMap(d.subs, (e) => {
					return e._id[`_id_customer_channelname`]
				}).map((e) => {
					e.breakdowns = e.subs[0]._id
					d.count = 1
					return e
				})

				d.subs = _.orderBy(subs, (e) => e.PL8A, 'desc')
				d.breakdowns = d.subs[0]._id
				d.count = d.subs.length
				return d
			})
		
			bkd.level(2)
			let newParsed = _.orderBy(parsed, (d) => d.PL8A, 'desc')
			return newParsed
		}

		if (bkd.breakdownBranch_ChannelRDNonRD() != '') {
			let injectTotal = (data) => {
				let renderTotalColumn = (d) => {
					let totalColumn = {}
					totalColumn._id = 'Total'
					totalColumn.count = 1
					totalColumn.excludeFromTotal = true

					let totalSubColumn = {}
					totalSubColumn._id = 'Total'
					totalSubColumn.count = 1
					totalSubColumn.excludeFromTotal = true

					for (let p in d.subs[0]) {
						if (d.subs[0].hasOwnProperty(p) && p.search('PL') > -1) {
							totalColumn[p] = toolkit.sum(d.subs, (e) => e[p])
							totalSubColumn[p] = toolkit.sum(d.subs, (e) => e[p])
						}
					}

					totalColumn.subs = [totalSubColumn]
					return totalColumn
				}

				data.forEach((d) => {
					let totalColumn = renderTotalColumn(d)
					d.subs = [totalColumn].concat(d.subs)
					d.count = toolkit.sum(d.subs, (e) => e.count)
				})
			}

			let parsed = groupThenMap(data, (d) => {
				return d._id[`_id_customer_branchname`]
			}).map((d) => {
				let subs = groupThenMap(d.subs, (e) => {
					return (e._id._id_customer_channelid == 'I1') ? 'RD' : 'Non RD'
				}).map((e) => {
					e.breakdowns = e.subs[0]._id
					d.count = 1
					return e
				})

				d.subs = _.orderBy(subs, (e) => e.PL8A, 'desc')
				d.breakdowns = d.subs[0]._id
				d.count = d.subs.length
				return d
			})
		
			bkd.level(2)
			// if (bkd.breakdownBranch_ChannelRDNonRD() == 'All') {
			// 	injectTotal(parsed)
			// }
			let newParsed = _.orderBy(parsed, (d) => d.PL8A, 'desc')
			return newParsed
		}

		if (bkd.breakdownBranch_SubChannel() != '') {
			let parsed = groupThenMap(data, (d) => {
				return d._id[`_id_customer_branchname`]
			}).map((d) => {
				let subs = groupThenMap(d.subs, (e) => {
					return e._id._id_customer_reportsubchannel
				}).map((e) => {
					e.breakdowns = e.subs[0]._id
					d.count = 1
					return e
				})

				d.subs = _.orderBy(subs, (e) => e.PL8A, 'desc')
				d.breakdowns = d.subs[0]._id
				d.count = d.subs.length
				return d
			})
		
			bkd.level(2)
			let newParsed = _.orderBy(parsed, (d) => d.PL8A, 'desc')
			return newParsed
		}
	}

	let parsed = groupThenMap(data, (d) => {
		return d._id[`_id_${toolkit.replace(bkd.breakdownBy(), '.', '_')}`]
	}).map((d) => {
		d.breakdowns = d.subs[0]._id
		d.count = 1

		return d
	})

	bkd.level(1)
	let newParsed = _.orderBy(parsed, (d) => d.PL8A, 'desc')
	return newParsed
}

bkd.render = () => {
	if (bkd.data().length == 0) {
		$('.breakdown-view').html('No data found.')
		return
	}


	// ========================= TABLE STRUCTURE

	let percentageWidth = 110

	let wrapper = toolkit.newEl('div')
		.addClass('pivot-pnl-branch pivot-pnl')
		.appendTo($('.breakdown-view'))

	let tableHeaderWrap = toolkit.newEl('div')
		.addClass('table-header')
		.appendTo(wrapper)

	let tableHeader = toolkit.newEl('table')
		.addClass('table')
		.appendTo(tableHeaderWrap)

	let tableContentWrap = toolkit.newEl('div')
		.appendTo(wrapper)
		.addClass('table-content')

	let tableContent = toolkit.newEl('table')
		.addClass('table')
		.appendTo(tableContentWrap)

	let trHeader = toolkit.newEl('tr')
		.appendTo(tableHeader)

	toolkit.newEl('th')
		.html('P&L')
		.css('height', `${34 * bkd.level()}px`)
		.attr('data-rowspan', bkd.level())
		.css('vertical-align', 'middle')
		.addClass('cell-percentage-header')
		.appendTo(trHeader)

	toolkit.newEl('th')
		.html('Total')
		.css('height', `${34 * bkd.level()}px`)
		.attr('data-rowspan', bkd.level())
		.css('vertical-align', 'middle')
		.addClass('cell-percentage-header align-right')
		.appendTo(trHeader)

	toolkit.newEl('th')
		.html('% of Net Sales')
		.css('height', `${34 * bkd.level()}px`)
		.css('vertical-align', 'middle')
		.css('font-weight', 'normal')
		.css('font-style', 'italic')
		.width(percentageWidth - 20)
		.attr('data-rowspan', bkd.level())
		.addClass('cell-percentage-header align-right')
		.appendTo(trHeader)

	let trContents = []
	for (let i = 0; i < bkd.level(); i++) {
		trContents.push(toolkit.newEl('tr').appendTo(tableContent))
	}



	// ========================= BUILD HEADER

	let data = bkd.data()

	let columnWidth = 130
	let totalColumnWidth = 0
	let pnlTotalSum = 0
	let dataFlat = []

	let countWidthThenPush = (thheader, each, key) => {
		let currentColumnWidth = each._id.length * (bkd.isBreakdownChannel() ? 10 : 6)
		if (currentColumnWidth < columnWidth) {
			currentColumnWidth = columnWidth
		}

		if (each.hasOwnProperty('width')) {
			currentColumnWidth = each.width
		}

		each.key = key.join('_')
		dataFlat.push(each)

		totalColumnWidth += currentColumnWidth
		thheader.width(currentColumnWidth)
	}

	data.forEach((lvl1, i) => {
		let thheader1 = toolkit.newEl('th')
			.html(lvl1._id)
			.attr('colspan', lvl1.count)
			.addClass('align-center')
			.appendTo(trContents[0])

		if (bkd.level() == 1) {
			countWidthThenPush(thheader1, lvl1, [lvl1._id])

			totalColumnWidth += percentageWidth
			let thheader1p = toolkit.newEl('th')
				.html('% of Net Sales')
				.width(percentageWidth)
				.addClass('align-center')
				.css('font-weight', 'normal')
				.css('font-style', 'italic')
				.appendTo(trContents[0])

			return
		}
		thheader1.attr('colspan', lvl1.count * 2)

		lvl1.subs.forEach((lvl2, j) => {
			let thheader2 = toolkit.newEl('th')
				.html(lvl2._id)
				.addClass('align-center')
				.appendTo(trContents[1])

			if (bkd.level() == 2) {
				countWidthThenPush(thheader2, lvl2, [lvl1._id, lvl2._id])

				totalColumnWidth += percentageWidth
				let thheader1p = toolkit.newEl('th')
					.html('% of Net Sales')
					.width(percentageWidth)
					.addClass('align-center')
					.css('font-weight', 'normal')
					.css('font-style', 'italic')
					.appendTo(trContents[1])

				return
			}
			thheader2.attr('colspan', lvl2.count)
		})
	})

	tableContent.css('min-width', totalColumnWidth)



	// ========================= CONSTRUCT DATA
	
	let plmodels = _.sortBy(rpt.plmodels(), (d) => parseInt(d.OrderIndex.replace(/PL/g, '')))
	let exceptions = ["PL94C" /* "Operating Income" */, "PL39B" /* "Earning Before Tax" */, "PL41C" /* "Earning After Tax" */, "PL6A" /* "Discount" */]
	let netSalesPLCode = 'PL8A'
	let netSalesRow = {}
	let rows = []

	rpt.fixRowValue(dataFlat)

	console.log("dataFlat", dataFlat)

	dataFlat.forEach((e) => {
		let breakdown = e.key
		netSalesRow[breakdown] = e[netSalesPLCode]
	})

	plmodels.forEach((d) => {
		let row = { PNL: d.PLHeader3, PLCode: d._id, PNLTotal: 0, Percentage: 0 }
		dataFlat.forEach((e) => {
			let breakdown = e.key
			let value = e[`${d._id}`]; 
			row[breakdown] = value

			if (toolkit.isDefined(e.excludeFromTotal)) {
				return
			}

			row.PNLTotal += value
		})
		dataFlat.forEach((e) => {
			let breakdown = e.key
			let percentage = toolkit.number(row[breakdown] / row.PNLTotal) * 100; 
			percentage = toolkit.number(percentage)

			if (d._id != netSalesPLCode) {
				percentage = toolkit.number(row[breakdown] / netSalesRow[breakdown]) * 100
			}

			if (percentage < 0)
				percentage = percentage * -1

			row[`${breakdown} %`] = percentage
		})

		if (exceptions.indexOf(row.PLCode) > -1) {
			return
		}

		rows.push(row)
	})

	console.log("rows", rows)
	
	let TotalNetSales = _.find(rows, (r) => { return r.PLCode == "PL8A" }).PNLTotal
	rows.forEach((d, e) => {
		let TotalPercentage = (d.PNLTotal / TotalNetSales) * 100;
		if (TotalPercentage < 0)
			TotalPercentage = TotalPercentage * -1 
		rows[e].Percentage = toolkit.number(TotalPercentage)
	})




	// ========================= PLOT DATA

	rows.forEach((d, i) => {
		pnlTotalSum += d.PNLTotal

		let PL = d.PLCode
		PL = PL.replace(/\s+/g, '')
		let trHeader = toolkit.newEl('tr')
			.addClass(`header${PL}`)
			.attr(`idheaderpl`, PL)
			.attr(`data-row`, `row-${i}`)
			.appendTo(tableHeader)

		trHeader.on('click', () => {
			bkd.clickExpand(trHeader)
		})

		toolkit.newEl('td')
			.html('<i></i>' + d.PNL)
			.appendTo(trHeader)

		let pnlTotal = kendo.toString(d.PNLTotal, 'n0')
		toolkit.newEl('td')
			.html(pnlTotal)
			.addClass('align-right')
			.appendTo(trHeader)

		toolkit.newEl('td')
			.html(kendo.toString(d.Percentage, 'n2') + ' %')
			.addClass('align-right')
			.appendTo(trHeader)

		let trContent = toolkit.newEl('tr')
			.addClass(`column${PL}`)
			.attr(`idpl`, PL)
			.attr(`data-row`, `row-${i}`)
			.appendTo(tableContent)

		dataFlat.forEach((e, f) => {
			let key = e.key
			let value = kendo.toString(d[key], 'n0')
			let percentage = kendo.toString(d[`${key} %`], 'n2') + ' %'

			if ($.trim(value) == '') {
				value = 0
			}

			let cell = toolkit.newEl('td')
				.html(value)
				.addClass('align-right')
				.appendTo(trContent)

			let cellPercentage = toolkit.newEl('td')
				.html(percentage)
				.addClass('align-right')
				.appendTo(trContent)

			$([cell, cellPercentage]).on('click', () => {
				bkd.renderDetail(d.PLCode, e.breakdowns)
			})
		})

		let boolStatus = false
		trContent.find('td').each((a,e) => {
			if ($(e).text() != '0' && $(e).text() != '0.00 %') {
				boolStatus = true
			}
		})

		if (boolStatus) {
			trContent.attr('statusval', 'show')
			trHeader.attr('statusval', 'show')
		} else {
			trContent.attr('statusval', 'hide')
			trHeader.attr('statusval', 'hide')
		}
	})
	

	// ========================= CONFIGURE THE HIRARCHY
	rpt.buildGridLevels(rows)
}

bkd.optionBreakdownValues = ko.observableArray([])
bkd.breakdownValueAll = { _id: 'All', Name: 'All' }
bkd.changeBreakdown = () => {
	let all = bkd.breakdownValueAll
	let map = (arr) => arr.map((d) => {
		if ("customer.channelname" == bkd.breakdownBy()) {
			return d
		}
		if ("customer.keyaccount" == bkd.breakdownBy()) {
			return { _id: d._id, Name: d._id }
		}

		return { _id: d.Name, Name: d.Name }
	})
	setTimeout(() => {
		bkd.isBreakdownBranch(false)
		bkd.breakdownBranch_Channels([])
		bkd.breakdownBranch_ChannelRDNonRD('')
		bkd.breakdownBranch_SubChannel('')

		bkd.isBreakdownChannel(false)
		// bkd.breakdownChannels([])
		// bkd.breakdownChannelLocation([])

		switch (bkd.breakdownBy()) {
			case "customer.areaname":
				bkd.optionBreakdownValues([all].concat(map(rpt.masterData.Area())))
				bkd.breakdownValue([all._id])
			break;
			case "customer.region":
				bkd.optionBreakdownValues([all].concat(map(rpt.masterData.Region())))
				bkd.breakdownValue([all._id])
			break;
			case "customer.zone":
				bkd.optionBreakdownValues([all].concat(map(rpt.masterData.Zone())))
				bkd.breakdownValue([all._id])
			break;
			case "product.brand":
				bkd.optionBreakdownValues([all].concat(map(rpt.masterData.Brand())))
				bkd.breakdownValue([all._id])
			break;
			case "customer.branchname":
				bkd.optionBreakdownValues([all].concat(map(rpt.masterData.Branch())))
				bkd.breakdownValue([all._id])

				// bkd.isBreakdownBranch(true)
			break;
			case "customer.channelname":
				bkd.optionBreakdownValues([all].concat(map(rpt.masterData.Channel())))
				bkd.breakdownValue([all._id])

				bkd.isBreakdownChannel(true)
				bkd.breakdownChannels([])
			break;
			case "customer.keyaccount":
				bkd.optionBreakdownValues([all].concat(map(rpt.masterData.KeyAccount())))
				bkd.breakdownValue([all._id])
			break;
		}
	}, 100)
}
bkd.changeBreakdownValue = () => {
	let all = bkd.breakdownValueAll
	setTimeout(() => {
		let condA1 = bkd.breakdownValue().length == 2
		let condA2 = bkd.breakdownValue().indexOf(all._id) == 0
		if (condA1 && condA2) {
			bkd.breakdownValue.remove(all._id)
			return
		}

		let condB1 = bkd.breakdownValue().length > 1
		let condB2 = bkd.breakdownValue().reverse()[0] == all._id
		if (condB1 && condB2) {
			bkd.breakdownValue([all._id])
			return
		}

		let condC1 = bkd.breakdownValue().length == 0
		if (condC1) {
			bkd.breakdownValue([all._id])
		}
	}, 100)
}






viewModel.summary = {}
let smry = viewModel.summary

smry.summaryMode = ko.observable('overview')








viewModel.dashboard = {}
let dsbrd = viewModel.dashboard

dsbrd.rows = ko.observableArray([
	// { pnl: 'Gross Sales', plcodes: ["PL1", "PL2", "PL3", "PL4", "PL5", "PL6"] },
	{ pnl: "Net Sales", plcodes: ["PL8A"] },
	{ pnl: 'Growth', plcodes: [] }, // NOT YET
	{ pnl: 'Sales Discount', plcodes: ["PL7", "PL8"] },
	// { pnl: 'ATL', plcodes: ["PL28"] },
	// { pnl: 'BTL', plcodes: ["PL29", "PL30", "PL31", "PL32"] },
	{ pnl: "COGS", plcodes: ["PL74B"] },
	{ pnl: "Gross Margin", plcodes: ["PL74C"] },
	{ pnl: "SGA", plcodes: ["PL94A"] },
	{ pnl: "Royalties", plcodes: ["PL26A"] },
	{ pnl: "EBITDA", plcodes: ["PL44C"] },
	{ pnl: "EBIT %", plcodes: [] },
	{ pnl: "EBIT", plcodes: ["PL44B"] },
])

dsbrd.data = ko.observableArray([])
dsbrd.columns = ko.observableArray([])
dsbrd.breakdown = ko.observable('customer.channelname')
dsbrd.fiscalYears = ko.observableArray(rpt.value.FiscalYears())
dsbrd.contentIsLoading = ko.observable(false)
dsbrd.optionStructures = ko.observableArray([
	{ field: "date.fiscal", name: "Fiscal Year" },
	{ field: "date.quartertxt", name: "Quarter" },
	{ field: "date.month", name: "Month" }
])
dsbrd.structure = ko.observable(dsbrd.optionStructures()[0].field)
// dsbrd.structureYear = ko.observable('date.year')
dsbrd.optionBreakdownValues = ko.observableArray([])
dsbrd.breakdownValue = ko.observableArray([])
dsbrd.breakdownValueAll = { _id: 'All', Name: 'All' }
dsbrd.changeBreakdown = () => {
	let all = dsbrd.breakdownValueAll
	let map = (arr) => arr.map((d) => {
		if (dsbrd.breakdown() == "customer.channelname") {
			return d
		}

		return { _id: d.Name, Name: d.Name }
	})
	setTimeout(() => {
		switch (dsbrd.breakdown()) {
			case "customer.branchname":
				dsbrd.optionBreakdownValues([all].concat(map(rpt.masterData.Branch())))
				dsbrd.breakdownValue([all._id])
			break;
			case "product.brand":
				dsbrd.optionBreakdownValues([all].concat(map(rpt.masterData.Brand())))
				dsbrd.breakdownValue([all._id])
			break;
			case "customer.channelname":
				dsbrd.optionBreakdownValues([all].concat(map(rpt.masterData.Channel())))
				dsbrd.breakdownValue([all._id])
			break;
			case "customer.zone":
				dsbrd.optionBreakdownValues([all].concat(map(rpt.masterData.Zone())))
				dsbrd.breakdownValue([all._id])
			break;
			case "customer.areaname":
				dsbrd.optionBreakdownValues([all].concat(map(rpt.masterData.Area())))
				dsbrd.breakdownValue([all._id])
			break;
			case "customer.region":
				dsbrd.optionBreakdownValues([all].concat(map(rpt.masterData.Region())))
				dsbrd.breakdownValue([all._id])
			break;
			case "customer.keyaccount":
				dsbrd.optionBreakdownValues([all].concat(map(rpt.masterData.KeyAccount())))
				dsbrd.breakdownValue([all._id])
			break;
		}
	}, 100)
}

dsbrd.changeBreakdownValue = () => {
	let all = dsbrd.breakdownValueAll
	setTimeout(() => {
		let condA1 = dsbrd.breakdownValue().length == 2
		let condA2 = dsbrd.breakdownValue().indexOf(all._id) == 0
		if (condA1 && condA2) {
			dsbrd.breakdownValue.remove(all._id)
			return
		}

		let condB1 = dsbrd.breakdownValue().length > 1
		let condB2 = dsbrd.breakdownValue().reverse()[0] == all._id
		if (condB1 && condB2) {
			dsbrd.breakdownValue([all._id])
			return
		}

		let condC1 = dsbrd.breakdownValue().length == 0
		if (condC1) {
			dsbrd.breakdownValue([all._id])
		}
	}, 100)
}

dsbrd.refresh = () => {
	if (dsbrd.breakdownValue().length == 0) {
		toolkit.showError('Please choose at least breakdown value')
		return
	}

	let param = {}
	param.pls = _.flatten(dsbrd.rows().map((d) => d.plcodes))
	param.groups = rpt.parseGroups([dsbrd.breakdown(), dsbrd.structure()])
	param.aggr = 'sum'
	param.filters = rpt.getFilterValue(true, dsbrd.fiscalYears)

	let breakdownValue = dsbrd.breakdownValue().filter((d) => d != 'All')
	if (breakdownValue.length > 0) {
		param.filters.push({
			Field: dsbrd.breakdown(),
			Op: '$in',
			Value: dsbrd.breakdownValue()
		})
	}

	// if (dsbrd.structure() == 'date.month') {
	// 	param.groups.push(dsbrd.structureYear())
	// }

	let fetch = () => {
		toolkit.ajaxPost(viewModel.appName + "report/getpnldatanew", param, (res) => {
			if (res.Status == "NOK") {
				setTimeout(() => { fetch() }, 1000 * 5)
				return
			}

			if (rpt.isEmptyData(res)) {
				dsbrd.contentIsLoading(false)
				return
			}

			dsbrd.contentIsLoading(false)
			dsbrd.render(res)
		}, () => {
			dsbrd.contentIsLoading(false)
		})
	}

	dsbrd.contentIsLoading(true)
	fetch()
}

dsbrd.render = (res) => {
	let rows = []
	let rowsAfter = []
	let columnsPlaceholder = [{ 
		field: 'pnl', 
		title: 'PNL', 
		attributes: { class: 'bold' }, 
		headerAttributes: { style: 'font-weight: bold; vertical-align: middle;' }, 
		width: 120
	}, { 
		field: 'total', 
		title: 'Total', 
		attributes: { class: 'bold align-right bold' }, 
		headerAttributes: { style: 'font-weight: bold; vertical-align: middle; text-align: right;' }, 
		width: 150
	}]

	let data = res.Data.Data

	dsbrd.rows().forEach((row, rowIndex) => {
		row.columnData = []
		data.forEach((column, columnIndex) => {
			let columnAfter = {
				breakdownTitle: toolkit.redefine(column._id[`_id_${toolkit.replace(dsbrd.breakdown(), '.', '_')}`]), 
				structureTitle: toolkit.redefine(column._id[`_id_${toolkit.replace(dsbrd.structure(), '.', '_')}`]), 
				titleYear: parseInt(toolkit.redefine(column._id[`_id_date_fiscal`], '').split('-')[0], 10), 
				original: toolkit.sum(row.plcodes, (plcode) => toolkit.number(column[plcode])),
				value: toolkit.sum(row.plcodes, (plcode) => toolkit.number(column[plcode])),
			}

			row.columnData.push(columnAfter)
		})

		rowsAfter.push(row)
	})

	if (rowsAfter.length > 0) {
		let grossSales = rowsAfter.find((d) => d.pnl == 'Net Sales')
		let ebit = rowsAfter.find((d) => d.pnl == 'EBIT')
		let columns = rowsAfter[0].columnData

		rowsAfter.forEach((row, rowIndex) => {
			row.columnData.forEach((column, columnIndex) => {
				if (row.pnl == 'EBIT %') {
					let percentage = kendo.toString(toolkit.number(ebit.columnData[columnIndex].original / grossSales.columnData[columnIndex].original) * 100, 'n2')
					column.value = `${percentage} %`;
				} else if (row.pnl != 'Net Sales' && row.pnl != 'EBIT') {
					let percentage = kendo.toString(toolkit.number(column.original / grossSales.columnData[columnIndex].original) * 100, 'n2')
					column.value = `${percentage} %`;
				}
			})

			let total = toolkit.sum(row.columnData, (d) => d.original)
			row.total = kendo.toString(total, 'n0')
			if (row.pnl == 'EBIT %') {
				let totalGrossSales = toolkit.sum(grossSales.columnData, (d) => d.original)
				let totalEbit = toolkit.sum(ebit.columnData, (d) => d.original)
				let percentage = toolkit.number(totalEbit / totalGrossSales) * 100
				row.total = `${kendo.toString(percentage, 'n2')} %`
			}
		})
	}

	let columnData = []
	data.forEach((d, i) => {
		let columnInfo = rowsAfter[0].columnData[i]

		let column = {}
		column.field = `columnData[${i}].value`
		column.breakdown = $.trim(toolkit.redefine(columnInfo.breakdownTitle, ''))
		column.title = $.trim(columnInfo.structureTitle)
		column.width = 150
		column.format = '{0:n0}'
		column.attributes = { class: 'align-right' }
		column.headerAttributes = { 
			style: 'text-align: center !important; font-weight: bold; border-right: 1px solid white; ',
		}

		if (dsbrd.structure() == 'date.month') {
			let m = parseInt(column.title, 10) - 1 + 3
			let y = columnInfo.titleYear

			column.order = y * 100 + parseInt(column.title, 10)
			column.title = moment(new Date(y, m, 1)).format('MMMM YYYY')
		}

		columnData.push(column)
	})

	let op1 = _.groupBy(columnData, (d) => d.breakdown)
	let op2 = _.map(op1, (v, k) => { 
		return { 
			title: ($.trim(k) == '' ? '' : k), 
			columns: v,
			headerAttributes: { 
				style: 'text-align: center !important; font-weight: bold; border: 1px solid white; border-top: none; border-left: none; box-sizing: border-box; background-color: #e9eced;',
			}
		}
	})

	let columnGrouped = _.sortBy(op2, (d) => d.title)

	if (columnGrouped.length > 0) {
		columnsPlaceholder[0].locked = true
		columnsPlaceholder[1].locked = true
	}

	columnGrouped = _.orderBy(columnGrouped, (d) => {
		let dataColumns = rowsAfter[0].columnData
			.filter((e) => $.trim(e.breakdownTitle) == $.trim(d.title))
		if (dataColumns.length > 0) {
			return toolkit.sum(dataColumns, (e) => e.value)
		}

		return 0
	}, 'desc')

	columnGrouped.forEach((d) => {
		if (dsbrd.structure() == 'date.month') {
			d.columns = _.orderBy(d.columns, (e) => e.order, 'asc')
		}

		if (dsbrd.structure() == 'date.quartertxt') {
			d.columns = _.orderBy(d.columns, (e) => e.title, 'asc')
		}

		d.columns = _.orderBy(d.columns, (e) => e.value, 'desc')
	})

	dsbrd.data(rowsAfter)
	dsbrd.columns(columnsPlaceholder.concat(columnGrouped))

	let grossSales = dsbrd.data().find((d) => d.pnl == "Net Sales")
	let growth = dsbrd.data().find((d) => d.pnl == "Growth")

	let counter = 0
	let prevIndex = 0
	columnGrouped.forEach((d) => {
		d.columns.forEach((e, i) => {
			let index = toolkit.getNumberFromString(e.field)

			if ((i + 1) == d.columns.length) {
				e.attributes.style = `${e.attributes.style}; border-right: 1px solid rgb(240, 243, 244);`
			}

			if (i == 0) {
				prevIndex = index
				counter++
				return
			}

			let gs = grossSales.columnData[index]
			let gsPrev = grossSales.columnData[prevIndex]
			let g = growth.columnData[index]
			let value = toolkit.number((gs.value - gsPrev.value) / gsPrev.value) * 100
			g.value = `${kendo.toString(value, 'n2')} %`

			counter++
			prevIndex = index
		})
	})

	let config = {
		dataSource: {
			data: dsbrd.data()
		},
		columns: dsbrd.columns(),
		resizable: false,
		sortable: false, 
		pageable: false,
		filterable: false,
		dataBound: () => {
			let sel = '.grid-dashboard .k-grid-content-locked tr, .grid-dashboard .k-grid-content tr'

			$(sel).on('mouseenter', function () {
				let index = $(this).index()
				console.log(this, index)
		        let elh = $(`.grid-dashboard .k-grid-content-locked tr:eq(${index})`).addClass('hover')
		        let elc = $(`.grid-dashboard .k-grid-content tr:eq(${index})`).addClass('hover')
			})
			$(sel).on('mouseleave', function () {
				$('.grid-dashboard tr.hover').removeClass('hover')
			})
		}
	}

	$('.grid-dashboard').replaceWith('<div class="grid-dashboard"></div>')
	$('.grid-dashboard').kendoGrid(config)
}








viewModel.scatter = new Object()
let rs = viewModel.scatter
let dataPoints = [
	{field: "value1", name: "value1", aggr: "sum"}
]

rs.contentIsLoading = ko.observable(false)
rs.title = ko.observable('P&L Analytic')
rs.breakdownBy = ko.observable('customer.channelname')
rs.breakdownTimeBy = ko.observable('')
rs.selectedPNLNetSales = ko.observable("PL8A") // PL1
rs.selectedPNL = ko.observable("PL44B")
rs.chartComparisonNote = ko.observable('')
rs.optionDimensionSelect = ko.observableArray([])
rs.optionTimeBreakdowns = ko.observableArray([
	{ field: 'date.fiscal', name: 'Fiscal Year' },
	{ field: 'date.quartertxt', name: 'Quarter' },
	{ field: 'date.month', name: 'Month' },
])
rs.fiscalYear = ko.observable(rpt.value.FiscalYear())
rs.columnWidth = ko.observable(130)
rs.breakdownTimeValue = ko.observableArray([])
rs.optionTimeSubBreakdowns = ko.computed(() => {
	switch (rs.breakdownTimeBy()) {
		case 'date.fiscal': 
			return rpt.optionFiscalYears().slice(0).map((d) => {
				return { field: d, name: d }
			})
		break;
		case 'date.quartertxt': 
			return ['Q1', 'Q2', 'Q3', 'Q4'].map((d) => {
				return { field: d, name: d }
			})
		break;
		case 'date.month': 
			let y = parseInt(rs.fiscalYear().split('-')[0])
			return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((d) => {
				let m = d - 1 + 3
				return { field: d, name: moment(new Date(y, m, 0)).format('MMMM YYYY') }
			})
		break;
		default: return []; break;
	}
}, rs.breakdownTimeBy)
rs.changeBreakdownTimeBy = () => {
	rs.breakdownTimeValue([])
}

rs.getSalesHeaderList = () => {
	app.ajaxPost(viewModel.appName + "report/getplmodel", {}, (res) => {
		let data = res.map((d) => app.o({ field: d._id, name: d.PLHeader3 }))
			.filter((d) => d.PLHeader3 !== rs.selectedPNLNetSales())
		data = _.sortBy(data, function(item) {
					return [item.name]
				})
		rs.optionDimensionSelect(data)

		let prev = rs.selectedPNL()
		rs.selectedPNL('')
		setTimeout(() => {
			rs.selectedPNL(prev)
			rs.refresh(false)
		}, 300)
	})
}

rs.refresh = (useCache = false) => {
	rs.contentIsLoading(true)

	let groups = [rs.breakdownBy()]
	if (rs.breakdownTimeBy() != '') {
		groups.push(rs.breakdownTimeBy())
	}

	let param = {}
	param.pls = [rs.selectedPNL(), rs.selectedPNLNetSales()]
	param.groups = rpt.parseGroups(groups)
	param.aggr = 'sum'
	param.filters = rpt.getFilterValue(false, rs.fiscalYear)

	if (rs.breakdownTimeBy() == 'date.fiscal') {
		let fiscal = param.filters.find((d) => d.Field == rs.breakdownTimeBy())
		fiscal.Op = "$in"
		fiscal.Value = []

		if (rs.breakdownTimeValue().length > 0) {
			fiscal.Value = rs.breakdownTimeValue()
		} else {
			fiscal.Value = rpt.optionFiscalYears()
		}
	}

	let fetch = () => {
		app.ajaxPost(viewModel.appName + "report/getpnldatanew", param, (res) => {
			if (res.Status == "NOK") {
				setTimeout(() => {
					fetch()
				}, 1000 * 5)
				return
			}

			if (rpt.isEmptyData(res)) {
				rs.contentIsLoading(false)
				return
			}

			let date = moment(res.time).format("dddd, DD MMMM YYYY HH:mm:ss")
			rs.chartComparisonNote(`Last refreshed on: ${date}`)

			rs.contentIsLoading(false)

			let scatterViewWrapper = $('.scatter-view-wrapper').empty()
			let width = 0
			let raw = res.Data.Data

			if ((['date.fiscal', ''].indexOf(rs.breakdownTimeBy()) == -1) && rs.breakdownTimeValue().length > 0) {
				let field = `_id_${toolkit.replace(rs.breakdownTimeBy(), '.', '_')}`
				raw = raw.filter((d) => {
					for (let i = 0; i < rs.breakdownTimeValue().length; i++) {
						let each = rs.breakdownTimeValue()[i]

						switch (rs.breakdownTimeBy()) {
							case 'date.fiscal':
								if (each == d._id[field]) {
									return true
								}
							break;
							case 'date.quartertxt':
								if (d._id[field].indexOf(each) > -1) {
									return true
								}
							break;
							case 'date.month': 
								if (each == d._id[field]) {
									return true
								}
							break;
						}
					}

					return false
				})
			}

			if (rs.breakdownTimeBy() != '') {
				let op1 = _.groupBy(raw, (d) => d._id[`_id_${app.idAble(rs.breakdownBy())}`])
				_.map(op1, (v, k) => { 
					let eachWidth = rs.generateReport(k, v)
					width += eachWidth
				})
			} else {
				width = rs.generateReport('', raw)

				if (width < scatterViewWrapper.parent().width()) {
					width = '100%'
					scatterViewWrapper.find('.scatter-view').width(width)

					setTimeout(() => {
						scatterViewWrapper.find('.scatter-view').data('kendoChart').redraw()
					}, 100)
				}
			}

		    scatterViewWrapper
		    	.width(width)
				.append('<div class="clearfix" style="clear: both;"></div>')
		}, () => {
			rs.contentIsLoading(false)
		}, {
			cache: (useCache == true) ? 'pivot chart' : false
		})
	}

	fetch()
}

rs.generateReport = (title, raw) => {
	let breakdown = rs.breakdownTimeBy() == '' ? rs.breakdownBy() : rs.breakdownTimeBy()

	let dataAllPNL = raw
		.filter((d) => d.hasOwnProperty(rs.selectedPNL()))
		.map((d) => { return { _id: d._id, value: d[rs.selectedPNL()] } })
	let dataAllPNLNetSales = raw
		.filter((d) => d.hasOwnProperty(rs.selectedPNLNetSales()))
		.map((d) => { return { _id: d._id, value: d[rs.selectedPNLNetSales()] } })

	var sumNetSales = _.reduce(dataAllPNLNetSales, (m, x) => m + x.value, 0);
	let sumPNL = _.reduce(dataAllPNL, (m, x) => m + x.value, 0)
	let countPNL = dataAllPNL.length
	let avgPNL = sumPNL

	let data = []
	let multiplier = (sumNetSales == 0 ? 1 : sumNetSales)

	let safe = (d) => Math.abs(toolkit.number(d))

	dataAllPNL.forEach((d, i) => {
		let category = d._id[`_id_${app.idAble(breakdown)}`]
		let order = category

		if (breakdown == 'date.month') {
			let y = d._id[`_id_date_fiscal`].split('-')[0]
			let m = parseInt(category) - 1 + 3

			order = y * 100 + parseInt(category)
			category = moment(new Date(y, m, 1)).format('MMMM YYYY')
		}

		data.push({
			valueNetSales: dataAllPNLNetSales[i].value,
			category: category,
			order: order,
			valuePNL: safe(d.value),
			valuePNLPercentage: safe(d.value / dataAllPNLNetSales[i].value * 100),
			avgPNL: safe(avgPNL),
			avgPNLPercentage: safe(avgPNL / multiplier * 100),
		})
	})

	if (breakdown == 'date.quartertxt') {
		data = _.orderBy(data, (d) => d.order, 'asc')
	} else if (breakdown == 'date.month') {
		data = _.orderBy(data, (d) => parseInt(d.order, 10), 'asc')
	} else if (breakdown == 'date.fiscal') {
		data = _.orderBy(data, (d) => d.order.split('-')[0], 'asc')
	} else {
		data = _.orderBy(data, (d) => d.valuePNLPercentage, 'desc')
	}

	let max = _.max(_.map(data, (d) => d.avgNetSalesPercentage)
		.concat(_.map(data, (d) => d.valuePNLPercentage)))

	let netSalesTitle = rs.optionDimensionSelect().find((d) => d.field == rs.selectedPNLNetSales()).name
	let breakdownTitle = rs.optionDimensionSelect().find((d) => d.field == rs.selectedPNL()).name

	let scatterViewWrapper = $('.scatter-view-wrapper')
	let scatterView = $('<div class="scatter-view"></div>')
		.height(350)
		.css('float', 'left')
		.appendTo(scatterViewWrapper)

	console.log('----', data)

	let config = {
		dataSource: { data: data },
        // title: title,
        legend: {
            visible: true,
            position: "bottom"
        },
        seriesDefaults: {
            type: "line",
            missingValues: "gap",
        },
		seriesColors: ['#3498DB', "#678900"],
		series: [{
			name: `Average ${breakdownTitle} to ${netSalesTitle}`,
			field: 'avgPNLPercentage',
			width: 3,
			line: {
				border: {
					width: 1,
					color: 'white'
				},
			},
			tooltip: {
				visible: true,
				template: `Average ${breakdownTitle} to ${netSalesTitle}: #: kendo.toString(dataItem.avgPNLPercentage, 'n2') # % (#: kendo.toString(dataItem.avgPNL, 'n2') #)`
			},
			markers: { visible: false }
		}, {
			type: 'column',
			name: `${breakdownTitle} to ${netSalesTitle}`,
			field: "valuePNLPercentage",
			overlay: {
				gradient: 'none'
			},
			border: { width: 0 },
			tooltip: {
				visible: true,
				template: `${breakdownTitle} #: dataItem.category # to ${netSalesTitle}: #: kendo.toString(dataItem.valuePNLPercentage, 'n2') # % (#: kendo.toString(dataItem.valuePNL, 'n2') #)`
			},
			labels: {
				font: '"Source Sans Pro" 11px',
				visible: true,
				position: 'outsideEnd',
				template: (d) => {
					return `${breakdownTitle} ${d.category}\n${kendo.toString(d.value, 'n2')} %`
				}
			},
		}],
        valueAxis: {
			majorGridLines: { color: '#fafafa' },
            label: { format: "{0}%" },
            axisCrossingValue: [0, -10],
        	max: (max + 20),
        },
        categoryAxis: [{
            field: 'category',
            labels: {
				font: '"Source Sans Pro" 11px',
            },
			majorGridLines: { color: '#fafafa' }
		}],
    }

    if (rs.breakdownTimeBy() != '') {
    	config.categoryAxis.push({
			categories: [title],
            labels: {
				font: '"Source Sans Pro" 18px bold',
            },
		})
    }

	let width = (data.length * rs.columnWidth())
	if (width < 300) width = 300
	scatterView.width(width).kendoChart(config)
	return width
}








viewModel.dashboardRanking = {}
let rank = viewModel.dashboardRanking

rank.optionDimensions = ko.observableArray([
	{ field: 'NonRD', name: 'Non RD Sales' },
	{ field: 'OnlyRD', name: 'Only RD Sales' },
	{ field: 'customer.keyaccount', name: 'Key Account' },
].concat(rpt.optionDimensions().slice(0)))
rank.breakdown = ko.observable('customer.channelname')
rank.columns = ko.observableArray([
	{ field: 'pnl', title: 'PNL', attributes: { class: 'bold' } },
	{ field: 'gmPercentage', template: (d) => `${kendo.toString(d.gmPercentage, 'n2')} %`, title: 'GM %', type: 'percentage', attributes: { class: 'align-right' }, headerAttributes: { style: 'text-align: right !important;', class: 'bold tooltipster', title: 'Click to sort' } },
	{ field: 'cogsPercentage', template: (d) => `${kendo.toString(d.cogsPercentage, 'n2')} %`, title: 'COGS %', type: 'percentage', attributes: { class: 'align-right' }, headerAttributes: { style: 'text-align: right !important;', class: 'bold tooltipster', title: 'Click to sort' } },
	{ field: 'ebitPercentage', template: (d) => `${kendo.toString(d.ebitPercentage, 'n2')} %`, title: 'EBIT %', type: 'percentage', attributes: { class: 'align-right' }, headerAttributes: { style: 'text-align: right !important;', class: 'bold tooltipster', title: 'Click to sort' } },
	{ field: 'ebitdaPercentage', template: (d) => `${kendo.toString(d.ebitdaPercentage, 'n2')} %`, title: 'EBITDA %', type: 'percentage', attributes: { class: 'align-right' }, headerAttributes: { style: 'text-align: right !important;', class: 'bold tooltipster', title: 'Click to sort' } },
	{ field: 'netSales', title: 'Net Sales', type: 'number', attributes: { class: 'align-right' }, headerAttributes: { style: 'text-align: right !important;', class: 'bold tooltipster', title: 'Click to sort' }, format: '{0:n0}' },
	{ field: 'ebit', title: 'EBIT', type: 'number', attributes: { class: 'align-right' }, headerAttributes: { style: 'text-align: right !important;', class: 'bold tooltipster', title: 'Click to sort' }, format: '{0:n0}' },
])
rank.contentIsLoading = ko.observable(false)
rank.data = ko.observableArray([])
rank.fiscalYear = ko.observable(rpt.value.FiscalYear())

rank.refresh = () => {
	let breakdown = rank.breakdown()
	let isRDNonRD = (['OnlyRD', 'NonRD'].indexOf(rank.breakdown()) > -1)

	if (isRDNonRD) {
		breakdown = 'customer.channelname'
	}

	let param = {}
	param.pls = ["PL74C", "PL74B", "PL44B", "PL44C", "PL8A"]
	param.groups = rpt.parseGroups([breakdown])
	param.aggr = 'sum'
	param.filters = rpt.getFilterValue(false, rank.fiscalYear)

	if (isRDNonRD) {
		let values = ('OnlyRD' == rank.breakdown()) ? 
			['I1'] : ["EXP", "I2", "I4", "I6", "I3"]

		param.filters.push({
			Field: 'customer.channelname',
			Op: '$in',
			Value: values
		})
	}

	let fetch = () => {
		toolkit.ajaxPost(viewModel.appName + "report/getpnldatanew", param, (res) => {
			if (res.Status == "NOK") {
				setTimeout(() => { fetch() }, 1000 * 5)
				return
			}

			if (rpt.isEmptyData(res)) {
				rank.contentIsLoading(false)
				return
			}

			rank.contentIsLoading(false)
			rank.render(breakdown, res)
		}, () => {
			rank.contentIsLoading(false)
		})
	}

	rank.contentIsLoading(true)
	fetch()
}

rank.render = (breakdown, res) => {
	let data = _.sortBy(res.Data.Data, (d) => toolkit.redefine(d._id[`_id_${toolkit.replace(breakdown, '.', '_')}`], ''))

	let rows = []
	data.forEach((d) => {
		let row = {}
		row.original = d._id[`_id_${toolkit.replace(breakdown, '.', '_')}`]
		row.pnl = d._id[`_id_${toolkit.replace(breakdown, '.', '_')}`]
		if ($.trim(row.pnl) == '') {
			row.original = ''
			row.pnl = ''
		}
		// if (breakdown == 'date.month') {
		// 	row.original = (parseInt(row.pnl, 10) - 1)
		// 	row.pnl = moment(new Date(2015, row.original, 1)).format('MMMM')
		// }


		row.gmPercentage = toolkit.number(d.PL74C / d.PL8A) * 100
		row.cogsPercentage = toolkit.number(d.PL74B / d.PL8A) * 100
		row.ebitPercentage = toolkit.number(d.PL44B / d.PL8A) * 100
		row.ebitdaPercentage = toolkit.number(d.PL44C / d.PL8A) * 100
		row.netSales = d.PL8A
		row.ebit = d.PL44B
		rows.push(row)
	})

	rank.data(_.orderBy(rows, (d) => d.netSales, 'desc'))

	let config = {
		dataSource: {
			data: rank.data(),
			pageSize: 10,
		},
		columns: rank.columns(),
		resizabl: false,
		sortable: true, 
		pageable: true,
		filterable: false,
		dataBound: app.gridBoundTooltipster('.grid-ranking')
	}

	$('.grid-ranking').replaceWith('<div class="grid-ranking sortable"></div>')
	$('.grid-ranking').kendoGrid(config)
}








vm.currentMenu('P&L Performance')
vm.currentTitle('&nbsp;')
vm.breadcrumb([
	{ title: 'Godrej', href: viewModel.appName + 'page/landing' },
	{ title: 'Home', href: viewModel.appName + 'page/landing' },
	{ title: 'P&L Performance', href: '#' }
])

bkd.title('P&L by Channels')
rs.title('P&L Comparison to Net Sales')

rpt.refresh = () => {
	bkd.changeBreakdown()
	setTimeout(() => {
		bkd.breakdownValue(['All'])
		bkd.refresh(false)
	}, 200)

	dsbrd.changeBreakdown()
	setTimeout(() => {
		dsbrd.breakdownValue(['All'])
		dsbrd.refresh()
	}, 200)
	
	rs.getSalesHeaderList()
	rank.refresh()

	rpt.prepareEvents()
}

$(() => {
	rpt.refresh()
})
