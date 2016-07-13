viewModel.breakdown = new Object()
let ba = viewModel.breakdown

ba.contentIsLoading = ko.observable(false)
ba.popupIsLoading = ko.observable(false)
ba.title = ko.observable('Branch Analysis')
ba.detail = ko.observableArray([])
ba.limit = ko.observable(10)
ba.breakdownNote = ko.observable('')

ba.breakdownBy = ko.observable('customer.branchname')
ba.breakdownByChannel = ko.observable('customer.channelname')
ba.breakdownByFiscalYear = ko.observable('date.fiscal')
ba.oldBreakdownBy = ko.observable(ba.breakdownBy())
ba.optionDimensions = ko.observableArray(rpt.optionDimensions().filter((d) => d.field != 'customer.channelname'))

ba.data = ko.observableArray([])
ba.zeroValue = ko.observable(false)
ba.fiscalYear = ko.observable(rpt.value.FiscalYear())
ba.breakdownValue = ko.observableArray([])
ba.breakdownRD = ko.observable("All")
ba.optionBreakdownRD = ko.observableArray([
	{ id: "All", title: "RD & Non RD" },
	{ id: "OnlyRD", title: "Only RD Sales", label: "RD", channelid: "I1" },
	{ id: "NonRD", title: "Non RD Sales" },
])

ba.expand = ko.observable(false)
ba.enableExpand = ko.observable(true)
ba.changeBreakdownRD = () => {
	setTimeout(() => {
		if (ba.breakdownRD().search('ByLocation') > -1) {
			ba.expand(true)
			ba.enableExpand(false)
			return
		}

		ba.enableExpand(true)
	}, 100)
}

ba.level = ko.observable(2)

ba.buildStructure = (breakdownRD, expand, data) => {
	let rdCategories = ["Regional Distributor", "Non RD"]
	let keys = [
		"_id_customer_branchname",
		"_id_customer_channelid",
		"_id_customer_channelname",
	]

	let fixEmptySubs = (d) => {
		let subs = []
		rdCategories.forEach((cat, i) => {
			let row = d.subs.find((e) => e._id == cat)
			if (row == undefined) {
				let newRow = {}
				newRow._id = cat
				newRow.count = 1
				newRow.subs = []

				let newSubRow = {}
				newSubRow._id = cat
				newSubRow.count = 1
				newSubRow.subs = []
				for (let p in d.subs[0]) {
					if (d.subs[0].hasOwnProperty(p) && p.search("PL") > -1) {
						newSubRow[p] = 0
						newRow[p] = 0
					}
				}
				newRow.subs.push(newSubRow)

				row = newRow
			}

			subs[i] = row
		})
		return subs
	}

	let showAsBreakdown = (data) => {
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

		switch (ba.breakdownRD()) {
			case 'All': {
				data.forEach((d) => {
					let totalColumn = renderTotalColumn(d)
					d.subs = [totalColumn].concat(d.subs)
					d.count = toolkit.sum(d.subs, (e) => e.count)
				})
			} break;
			case 'OnlyMT':
			case 'OnlyGT':
			case 'OnlyRD':
			case 'OnlyIT': {
				// let opt = ba.optionBreakdownRD().find((d) => d.id == ba.breakdownRD())
				data.forEach((d) => {
					// d.subs = d.subs.filter((e) => e._id == opt.label)

					if (ba.expand()) {
						let totalColumn = renderTotalColumn(d)
						d.subs = [totalColumn].concat(d.subs)
					}

					d.count = toolkit.sum(d.subs, (e) => e.count)
				})
			} break;
			case 'NonRD': {
				data.forEach((d) => {
					d.subs = d.subs.filter((e) => 
						(['regional distributor', 'rd'].indexOf(e._id.toLowerCase()) == -1)
					)

					if (ba.expand()) {
						let totalColumn = renderTotalColumn(d)
						d.subs = [totalColumn].concat(d.subs)
					}

					d.count = toolkit.sum(d.subs, (e) => e.count)
				})
			} break;
		}
	}

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

	if (expand && ba.subBreakdownValue().length > 0) {
		let parsed = groupThenMap(data, (d) => {
			return d._id._id_customer_branchname
		}).map((d) => {
			let subs = groupThenMap(d.subs, (e) => {
				return e._id._id_customer_channelname
			}).map((e) => {
				let subs = groupThenMap(e.subs, (f) => {
					return f._id._id_customer_reportsubchannel
				}).map((f) => {
					f.count = 1
					return f
				})

				e.subs = _.orderBy(subs, (f) => f.PL8A, 'desc')
				e.count = e.subs.length
				return e
			})

			d.subs = _.orderBy(subs, (e) => e.PL8A, 'desc')
			d.count = toolkit.sum(d.subs, (e) => e.count)
			return d
		})

		ba.level(3)
		showAsBreakdown(parsed)
		parsed = _.orderBy(parsed, (d) => d.total, 'desc')

		parsed.forEach((g) => {
			g.subs.forEach((d, i) => {
				if (i == 0) {
					return
				}

				let sample = d.subs[0]
				let percentage = {}
				percentage._id = '% of Net Sales'
				percentage.count = 1
				percentage.excludeFromTotal = true
				// percentage.key = [d.key.split('_')[0], 'percentage'].join('_')

				let total = {}
				total._id = 'Total&nbsp;'
				total.count = 1
				total.excludeFromTotal = true

				for (let p in sample) if (sample.hasOwnProperty(p) && p.indexOf('PL') > -1) {
					let vTarget = toolkit.sum(d.subs, (h) => h[p])
					let vNetSales = toolkit.sum(d.subs, (h) => h.PL8A)
					let value = toolkit.number(vTarget / vNetSales) * 100
					percentage[p] = `${kendo.toString(value, 'n2')} %`
					total[p] = vTarget
				}

				d.subs = [percentage].concat(d.subs)
				d.count++
				g.count++
				d.subs = [total].concat(d.subs)
				d.count++
				g.count++
			})
		})

		return parsed
	} else

	if (expand && ba.subBreakdownValue().length == 0) {
		let parsed = groupThenMap(data, (d) => {
			return d._id._id_customer_branchname
		}).map((d) => {
			let subs = groupThenMap(d.subs, (e) => {
				return e._id._id_customer_channelid == "I1" ? rdCategories[0] : rdCategories[1]
			}).map((e) => {
				let subs = groupThenMap(e.subs, (f) => {
					return f._id._id_customer_channelname
				}).map((f) => {
					f.count = 1
					return f
				})

				e.subs = _.orderBy(subs, (f) => f.PL8A, 'desc')
				e.count = e.subs.length
				return e
			})

			d.subs = _.orderBy(subs, (e) => e.PL8A, 'desc')
			d.subs = fixEmptySubs(d) // INJECT THE EMPTY RD / NON RD
			d.count = toolkit.sum(d.subs, (e) => e.count)
			return d
		})

		ba.level(3)
		showAsBreakdown(parsed)
		parsed = _.orderBy(parsed, (d) => d.total, 'desc')

		parsed.forEach((g) => {
			g.subs.forEach((d, i) => {
				if (i == 0) {
					return
				}

				let sample = d.subs[0]
				let percentage = {}
				percentage._id = '% of Net Sales'
				percentage.count = 1
				percentage.excludeFromTotal = true
				// percentage.key = [d.key.split('_')[0], 'percentage'].join('_')

				let total = {}
				total._id = 'Total&nbsp;'
				total.count = 1
				total.excludeFromTotal = true

				for (let p in sample) if (sample.hasOwnProperty(p) && p.indexOf('PL') > -1) {
					let vTarget = toolkit.sum(d.subs, (h) => h[p])
					let vNetSales = toolkit.sum(d.subs, (h) => h.PL8A)
					let value = toolkit.number(vTarget / vNetSales) * 100
					percentage[p] = `${kendo.toString(value, 'n2')} %`
					total[p] = vTarget
				}

				if (d._id == 'Regional Distributor') {
					toolkit.try(() => { d.subs[0]._id = 'Total&nbsp;' })
					d.subs.push(percentage)
					d.count++
					g.count++
				} else {
					if (d.subs.length > 0) {
						if (d.subs[0]._id == 'Non RD') {
							toolkit.try(() => { d.subs[0]._id = 'Total&nbsp;' })
							d.subs.push(percentage)
							d.count++
							g.count++
						} else {
							d.subs = [percentage].concat(d.subs)
							d.count++
							g.count++
							d.subs = [total].concat(d.subs)
							d.count++
							g.count++
						}
					}
				}
			})
		})

		return parsed
	} else

	if (!expand && ba.breakdownRD() == 'All') {
		let parsed = groupThenMap(data, (d) => {
			return d._id._id_customer_branchname
		}).map((d) => {
			let subs = groupThenMap(d.subs, (e) => {
				return e._id._id_customer_channelid == "I1" ? rdCategories[0] : rdCategories[1]
			}).map((e) => {
				e.subs = []
				e.count = 1
				return e
			})

			d.subs = _.orderBy(subs, (e) => e.PL8A, 'desc')
			d.subs = fixEmptySubs(d) // INJECT THE EMPTY RD / NON RD
			d.count = toolkit.sum(d.subs, (e) => e.count)
			return d
		})

		ba.level(2)
		showAsBreakdown(parsed)
		parsed = _.orderBy(parsed, (d) => d.total, 'desc')

		parsed.forEach((d) => {
			let total = d.subs[0]
			let percentage = {}
			percentage._id = '% of Net Sales'
			percentage.count = 1
			percentage.excludeFromTotal = true
			// percentage.key = [d.key.split('_')[0], 'percentage'].join('_')

			for (let p in total) if (total.hasOwnProperty(p) && p.indexOf('PL') > -1) {
				let value = toolkit.number(total[p] / total.PL8A) * 100
				percentage[p] = `${kendo.toString(value, 'n2')} %`
			}

			d.count++
			d.subs.splice(1, 0, percentage)
		})

		return parsed
	}

	let parsed = groupThenMap(data, (d) => {
		return d._id._id_customer_branchname
	}).map((d) => {
		let subs = groupThenMap(d.subs, (e) => {
			return e._id._id_customer_channelname
		}).map((e) => {
			e.subs = []
			e.count = 1
			return e
		})

		d.subs = _.orderBy(subs, (e) => e.PL8A, 'desc')
		d.count = toolkit.sum(d.subs, (e) => e.count)
		return d
	})

	ba.level(2)
	showAsBreakdown(parsed)
	parsed = _.orderBy(parsed, (d) => d.total, 'desc')
	return parsed
}

ba.refresh = (useCache = false) => {
	let param = {}
	param.pls = []
	param.groups = [ba.breakdownByChannel(), ba.breakdownBy()]
	param.aggr = 'sum'
	param.filters = rpt.getFilterValue(false, ba.fiscalYear)

	let breakdownValue = ba.breakdownValue().filter((d) => d != 'All')
	if (breakdownValue.length > 0) {
		param.filters.push({
			Field: ba.breakdownBy(),
			Op: '$in',
			Value: ba.breakdownValue()
		})
	}

	if (ba.subBreakdownValue().length > 0) {
		param.groups.push('customer.reportsubchannel')

		param.filters.push({
			Field: 'customer.channelname',
			Op: '$in',
			Value: ba.subBreakdownValue()
		})
	} else {
		param.filters.push({
			Field: 'customer.channelname',
			Op: '$in',
			Value: ba.optionSubBreakdown().map((d) => d._id)
		})
	}

	let fetch = () => {
		toolkit.ajaxPost(viewModel.appName + "report/getpnldatanew", param, (res) => {
			if (res.Status == "NOK") {
				setTimeout(() => {
					fetch()
				}, 1000 * 5)
				return
			}

			if (rpt.isEmptyData(res)) {
				ba.contentIsLoading(false)
				return
			}

			let data = ba.buildStructure(ba.breakdownRD(), ba.expand(), res.Data.Data)
			ba.data(data)
			let date = moment(res.time).format("dddd, DD MMMM YYYY HH:mm:ss")
			ba.breakdownNote(`Last refreshed on: ${date}`)

			rpt.plmodels(res.Data.PLModels)
			ba.emptyGrid()
			ba.contentIsLoading(false)
			ba.render()
		}, () => {
			ba.emptyGrid()
			ba.contentIsLoading(false)
		}, {
			cache: (useCache == true) ? 'breakdown chart' : false
		})
	}

	ba.oldBreakdownBy(ba.breakdownBy())
	ba.contentIsLoading(true)
	fetch()
}

ba.clickExpand = (e) => {
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

ba.emptyGrid = () => {
	$('.breakdown-view').replaceWith(`<div class="breakdown-view ez"  id="branch-analysis"></div>`)
}

ba.render = () => {
	if (ba.data().length == 0) {
		$('.breakdown-view').html('No data found.')
		return
	}


	// ========================= TABLE STRUCTURE
	
	let percentageWidth = 110
	let data = _.orderBy(ba.data(), (d) => d.PL8A, 'desc')

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
		.css('height', `${34 * ba.level()}px`)
		.attr('data-rowspan', ba.level())
		.css('vertical-align', 'middle')
		.addClass('cell-percentage-header')
		.appendTo(trHeader)

	toolkit.newEl('th')
		.html('Total')
		.css('height', `${34 * ba.level()}px`)
		.attr('data-rowspan', ba.level())
		.css('vertical-align', 'middle')
		.addClass('cell-percentage-header align-right')
		.appendTo(trHeader)

	toolkit.newEl('th')
		.html('% of Net Sales')
		.css('height', `${34 * ba.level()}px`)
		.css('vertical-align', 'middle')
		.css('font-weight', 'normal')
		.css('font-style', 'italic')
		.width(percentageWidth - 20)
		.attr('data-rowspan', ba.level())
		.css('vertical-align', 'middle')
		.addClass('cell-percentage-header align-right')
		.appendTo(trHeader)

	let trContents = []
	for (let i = 0; i < ba.level(); i++) {
		trContents.push(toolkit.newEl('tr').appendTo(tableContent))
	}

	// ========================= BUILD HEADER

	let columnWidth = 100
	let totalColumnWidth = 0
	let pnlTotalSum = 0
	let dataFlat = []

	let countWidthThenPush = (thheader, each, key) => {
		let currentColumnWidth = each._id.length * 10
		if (currentColumnWidth < columnWidth) {
			currentColumnWidth = columnWidth
		}

		if (ba.expand() && ba.subBreakdownValue().length > 0) {
			if (ba.subBreakdownValue().indexOf('I1') > -1) {
				if (each._id == 'Other') {
					currentColumnWidth = 180
				}
			}
		}

		if (each._id == '% of Net Sales') {
			currentColumnWidth -= 20
			thheader.css('font-weight', 'normal')
					.css('font-style', 'italic')
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

		if (ba.level() == 1) {
			countWidthThenPush(thheader1, lvl1, [lvl1._id])
			return
		}
		thheader1.attr('colspan', lvl1.count)

		lvl1.subs.forEach((lvl2, j) => {
			let thheader2 = toolkit.newEl('th')
				.html(lvl2._id)
				.addClass('align-center')
				.appendTo(trContents[1])

			if (ba.level() == 2) {
				countWidthThenPush(thheader2, lvl2, [lvl1._id, lvl2._id])
				return
			}
			thheader2.attr('colspan', lvl2.count)

			lvl2.subs.forEach((lvl3, k) => {
				let thheader3 = toolkit.newEl('th')
					.html(lvl3._id)
					.addClass('align-center')
					.appendTo(trContents[2])

				if (ba.level() == 3) {
					countWidthThenPush(thheader3, lvl3, [lvl1._id, lvl2._id, lvl3._id])

					if (lvl3._id == 'Total') {
						thheader2.attr('rowspan', 2)
						thheader2.css('vertical-align', 'middle')
						thheader3.remove()
					}

					return
				}
				thheader3.attr('colspan', lvl3.count)
			})
		})
	})

	tableContent.css('min-width', totalColumnWidth)



	// ========================= CONSTRUCT DATA
	
	let plmodels = _.sortBy(rpt.plmodels(), (d) => parseInt(d.OrderIndex.replace(/PL/g, '')))
	let exceptions = ["PL94C" /* "Operating Income" */, "PL39B" /* "Earning Before Tax" */, "PL41C" /* "Earning After Tax" */, "PL6A" /* "Discount" */]
	let netSalesPLCode = 'PL8A'
	let netSalesPlModel = rpt.plmodels().find((d) => d._id == netSalesPLCode)
	let netSalesRow = {}, changeformula, formulayo

	let rows = []

	rpt.fixRowValue(dataFlat)
	
	plmodels.forEach((d) => {
		let row = { PNL: d.PLHeader3, PLCode: d._id, PNLTotal: 0, Percentage: 0 }
		dataFlat.forEach((e) => {
			let breakdown = e.key
			let value = e[`${d._id}`];
			row[breakdown] = value;

			if (toolkit.isDefined(e.excludeFromTotal)) {
				return
			}

			row.PNLTotal += value
		})
		// dataFlat.forEach((e) => {
		// 	let breakdown = e.key
		// 	let percentage = toolkit.number(e[`${d._id}`] / row.PNLTotal) * 100; 
		// 	percentage = toolkit.number(percentage)

		// 	if (d._id != netSalesPLCode) {
		// 		percentage = toolkit.number(row[breakdown] / netSalesRow[breakdown]) * 100
		// 	}

		// 	if (percentage < 0)
		// 		percentage = percentage * -1

		// 	row[`${breakdown} %`] = percentage
		// })

		if (exceptions.indexOf(row.PLCode) > -1) {
			return
		}

		rows.push(row)
	})
	
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
			ba.clickExpand(trHeader)
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
			.html(kendo.toString(d.Percentage, 'n2') + '%')
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

			let percentage = kendo.toString(d[`${key} %`], 'n2')

			if ($.trim(value) == '') {
				value = 0
			}

			if (e._id == "% of Net Sales") {
				value = d[key]
			}

			let cell = toolkit.newEl('td')
				.html(value)
				.addClass('align-right')
				.appendTo(trContent)
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

ba.breakdownValueAll = { _id: 'All', Name: 'All' }
ba.optionBreakdownValues = ko.computed(() => {
	let branches = rpt.masterData.Branch()
		.map((d) => { return { _id: d.Name, Name: d.Name }})
	return [ba.breakdownValueAll].concat(branches)
}, rpt.masterData.Branch)

ba.subBreakdownValue = ko.observableArray([])
ba.optionSubBreakdown = ko.computed(() => {
	switch (ba.breakdownRD()) {
		case 'All': 
			return rpt.optionsChannels()
		break;
		case 'OnlyRD':
			return rpt.optionsChannels().filter((d) => d._id == 'I1')
		break;
		case 'NonRD':
			return rpt.optionsChannels().filter((d) => d._id != 'I1')
		break;
	}

	return []
}, ba.breakdownRD)

ba.changeBreakdownValue = () => {
	let all = ba.breakdownValueAll
	setTimeout(() => {
		let condA1 = ba.breakdownValue().length == 2
		let condA2 = ba.breakdownValue().indexOf(all._id) == 0
		if (condA1 && condA2) {
			ba.breakdownValue.remove(all._id)
			return
		}

		let condB1 = ba.breakdownValue().length > 1
		let condB2 = ba.breakdownValue().reverse()[0] == all._id
		if (condB1 && condB2) {
			ba.breakdownValue([all._id])
			return
		}

		let condC1 = ba.breakdownValue().length == 0
		if (condC1) {
			ba.breakdownValue([all._id])
		}
	}, 100)
}

vm.currentMenu('Analysis')
vm.currentTitle('Branch Analysis')
vm.breadcrumb([
	{ title: 'Godrej', href: viewModel.appName + 'page/landing' },
	{ title: 'Home', href: viewModel.appName + 'page/landing' },
	{ title: 'Branch Analysis', href: '#' }
])

ba.title('&nbsp;')

rpt.refresh = () => {
	ba.refresh(false)
	rpt.prepareEvents()
}

$(() => {
	rpt.refresh()

	setTimeout(() => {
		ba.breakdownValue(['All'])
	}, 200)
})
