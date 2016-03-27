(function() {
	var showError = function showError(message){
		console.log('Error: ' + message);
	};
	var log = function log(message) {
		console.log(message);
	}
	var LiveApi = window['binary-live-api'].LiveApi;
	Bot.server = {}; 

	window.addEventListener('contract:finished', function(e){
		var details = [
			e.detail.statement, 
			e.detail.type, 
			e.detail.entrySpot, 
			new Date(parseInt(e.detail.entrySpotTime + '000')).toLocaleTimeString(),
			e.detail.exitSpot, 
			new Date(parseInt(e.detail.exitSpotTime + '000')).toLocaleTimeString(),
		];
		Bot.finish(e.detail.result, details);
	});

	window.addEventListener('tick:updated', function(e){
		if ( !Bot.server.strategyFinished ) {
			Bot.strategy(e.detail.tick, e.detail.direction);
		}
	});

	Bot.server.accounts = [['Select a token', '']];
	Bot.server.purchase_choices = [['Click to select', '']];

	Bot.server.addAccount = function addAccount(token){
		var api = new LiveApi();
		api.authorize(token).then(function(response){
			Bot.server.accounts.push([response.authorize.loginid, token]);
			api.disconnect()
		}, function(reason){
			api.disconnect()
			alert(reason.message);
		});
	};

	Bot.server.getAccounts = function getAccounts(){
		return Bot.server.accounts;
	};

	Bot.server.getPurchaseChoices = function getPurchaseChoices(){
		return Bot.server.purchase_choices;
	};

	Bot.server.portfolio = function portfolio(proposalContract, purchaseContract){
		Bot.server.api.getPortfolio().then(function(portfolio){
			var contractId = purchaseContract.buy.contract_id;
			portfolio.portfolio.contracts.forEach(function (contract) {
				if (contract.contract_id == contractId) {
					log('contract added: ' + contract.contract_id);
					Bot.server.contractService.addContract({
						statement: contract.transaction_id,
						startTime: contract.date_start + 1,
						duration: parseInt(proposalContract.echo_req.duration),
						type: contract.contract_type,
						barrier: proposalContract.echo_req.barrier
					});
				}
			});
		}, function(reason){
			showError(reason.message);
		});
	};

	Bot.server.purchase = function purchase(index){
		Bot.server.strategyFinished = true;
		log('purchase called');
		index -= 1;
		if ( Bot.contracts.length !== 0 && index >= 0 && index < Bot.contracts.length ) {
			var proposalContract = Bot.contracts[index];
			log('purchasing contract: ' + proposalContract.proposal.longcode);
			Bot.server.api.buyContract(proposalContract.proposal.id, proposalContract.proposal.ask_price).then(function(purchaseContract){
				Bot.server.portfolio(proposalContract, purchaseContract);
			}, function(reason){
				showError(reason.message);
			});
		}
	};

	Bot.server.requestHistory = function requestHistory(){
		Bot.server.api.getTickHistory(Bot.server.symbol,{
			"end": "latest",
			"count": Bot.server.contractService.getCapacity(),
			"subscribe": 1,
		}).then(function(value){
			log('Request for history');
		}, function(reason){
			showError(reason.message);
		});
	};

	Bot.server.observeTicks = function observeTicks(){

		Bot.server.api.events.on('tick', function (feed) {
			log('tick received at: ' + feed.tick.epoch);
			if (feed && feed.echo_req.ticks_history === Bot.server.symbol) {
				Bot.server.contractService.addTick(feed.tick);
			}
		});

		Bot.server.api.events.on('history', function (feed) {
			if (feed && feed.echo_req.ticks_history === Bot.server.symbol) {
				Bot.server.contractService.addHistory(feed.history);
			}
		});

		Bot.server.requestHistory();
	};

	Bot.server.submitProposal = function submitProposal(options){
		Bot.server.api.getPriceProposalForContract(options).then(function(value){
			log('contract added: ' + value.proposal.longcode);
			if ( Bot.contracts.length === 1 ) {
				Bot.server.strategyFinished = false;
			}
			Bot.contracts.push(value);
		}, function(reason){
			showError(reason.message);
		});
	};

	Bot.server.init = function init(token, callback, strategy, finish){
		if ( Bot.server.hasOwnProperty('api') ) {
			Bot.server.api.disconnect();
		}
		Bot.server.api = new LiveApi();
		Bot.server.api.authorize(token).then(function(authorize){
			Bot.server.contractService = ContractService();	
			Bot.contracts = [];
			Bot.server.strategyFinished = true;
			Bot.strategy = strategy;
			Bot.finish = finish;
			Bot.server.observeTicks();
			callback();
		}, function(reason){
			showError(reason.message);
		});
	};
})();