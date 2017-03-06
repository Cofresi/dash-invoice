// (function($){

    // Plugin Config

    var socket = null;

    var config = {
        paymentWindowOpts: {
            headerColor: '#1c75bc',
            title:'Send DASH to ...',
            overlayClose: false,
            width: 500,
            height: 500,
            padding: 25,
            radius: 1,
            autoOpen: false,
            overlayColor: 'rgba(0, 0, 0, 0.6)'
        },
        network: 'testnet',
        provider: 'https://dev-test.dash.org',
        transactionOpts: {
            confirmations: 1,
            pendingNotificationInterval: 5,
            pollingInterval: 2000
        },
        functions: {
            transactionPending: transactionPending,
            transactionReceived: transactionReceived,
            transactionConfirmed: transactionConfirmed
        }
    };

    function transactionPending(opts) {
        console.log('transactionPending');
        var conftext = "Waiting for " + opts.confirmations + " confirmations...";
        jQuery('#checkout_status').html('Transaction was sent<br><span style="font-size:.8em">' + conftext);
        $('#inv-click').text('Payment pending');

    }

    function transactionReceived(opts, res) {
        console.log('transactionReceived');
        var conftext = "(" + res.confirmations + "/" + opts.confirmations + " confirmations)";
        jQuery('#checkout_status').html('Transaction Received<br><span style="font-size:.8em">' + conftext);
        $('#inv-click').text('Payment pending');

    }

    function transactionConfirmed(opts, res) {
        console.log('transactionConfirmed');
        var conftext = ""
        if(res.txlock) {
            conftext = "(InstantSend)";
        }
        else {
            conftext = "(" + res.confirmations + "/" + opts.confirmations + " confirmations)";
        }
        jQuery('#checkout_status').html('Transaction Confirmed<br><span style="font-size:.8em">' + conftext);
        $('#inv-click').text('Invoice paid');

    }


















    

    function Checkout() {

        this._cache = [];
        this._pendingConfirmation = [];
        this._paymentReceiver = null;
        this._orderId = null; // external_id for Payment Receiver

    	this.initialized = false;
        this.checkoutActive = false;
        this.paymentWindowActive = false;
        this.socketConnected = false;

        this.provider = 'https://dev-test.dash.org';

        this._cachedPrice = null;

        // document handlers

        // on document.ready

        // on body.update_checkout

    }


    Checkout.prototype.init = function(opts, paymentReceiver, socket, cb) {
        var self = this;

	    this.network = opts.network || 'testnet';

        this.confirmations = opts.confirmations || 1;

        this.socket = io(socket);
        console.log ('socket: ' + socket)

        if (!this._paymentReceiver) {

            this._paymentReceiver = {
                "receiver_id": paymentReceiver.receiver_id,
                "username": paymentReceiver.username,
                "dash_payment_address": paymentReceiver.dash_payment_address,
                "amount_fiat": paymentReceiver.amount_fiat,
                "type_fiat": paymentReceiver.type_fiat,
                "base_fiat": paymentReceiver.base_fiat,
                "amount_duffs": paymentReceiver.amount_duffs,
                "description": paymentReceiver.description
            };
        }

        // if socket is passed connect and subscribe to paymentReceiver.dash_payment_address

        if(socket) {
            this.socketConnected = this.initSocket(paymentReceiver.dash_payment_address);
        }
        else {
            console.log('no socket');
        }

        this.initialized = true;

        cb(null,self);
    };

    Checkout.prototype.initSocket = function(address) {
        var self = this;

        var socket = this.socket;

        console.log("-socketio-");
        console.log("listening to: " + address);

        if (address) {
            var address = address;
        } else {
            return false; // inactive socket status
        }

        console.log('trying to connect to ' + socket + '...' );

        socket.on('connect', function() {
            socket.emit('subscribe', 'dps');
            socket.emit('subscribe', 'block');
            socket.emit('subscribe', 'txlock');
            socket.emit('subscribe', 'bitcoind/addresstxid', [ address ]);
        });


        socket.on('callback',function(data){
            var callback=jQuery.parseJSON(data);
            console.log(callback.receiver_id);
            if(receivers.indexOf(callback.receiver_id)>-1) {
                document.getElementById('websocketCallback').value=data;
                var index = receivers.indexOf(callback.receiver_id);
                receivers.splice(index,1);
            }
        });


        socket.on('block', function(data) {
            console.log('block: '+ data);

            // get transaction by txid
            // send update to WooCommerce API

            // update payment receiver window

        });

        socket.on('txlock', function(data) {
            console.log('txlock: '+ data);

            // TODO - extend bitcoind/addresstxlockid ?

            // or just filter it out to only relate to 'address'

        });

        socket.on('bitcoind/addresstxid', function(data) {
            console.log('addresstxid: '+ data.txid);


            // now poll for transaction

            jQuery("#click2pay").prop('disabled', true);
            $('#inv-click').click(function(e) {
                e.preventDefault();
                //noop
            });

            var txid = data.txid;
            self.getTx(txid, function(err, res) {

                self._pendingConfirmation.push(res);

                console.log(res);

                self.verifyTransaction(config.transactionOpts, txid, transactionPending, transactionReceived, transactionConfirmed);


            });


            // check woocommerce for txlock

            // get transaction by txid
            // send update to WooCommerce API

            // check time of last block
            // update payment receiver window

        });

        return true; // active socket status
    };


    Checkout.prototype.verifyTransaction = function(opts, txid, transactionPending, transactionReceived, transactionConfirmed) {
        var self = this;

        var i = 0;

        transactionPending(opts);

        var refreshId = setInterval( function() {
            console.log('polling...');

            self.getTx(txid, function(err, res) {

                self._pendingConfirmation.push(res);

                console.log(res);

                var conf = parseInt(res.confirmations);
                var txlock = res.txlock;
                console.log("txlock: " + txlock);

                if (txlock) {
                    transactionConfirmed(opts, res);
                    clearInterval(refreshId);;
                }

                if (conf > 0) {


                    if (i < opts.pendingNotificationInterval) {
                        i++;
                    } else {

                        // TODO - update eCommerce database with confirmation ?

                        transactionPending(res);
                        i = 0;
                    }

                    if(res.txlock == 'true') {

                        console.log('txlock detected for txid: ' + res.txid);
                        console.log(res);

                        transactionConfirmed(opts, res);
                        clearInterval(refreshId);;

                    }
                    if (res.txid) {


                            transactionReceived(opts, res);

                            if (conf === opts.confirmations) {

                                transactionConfirmed(opts, res);
                                clearInterval(refreshId);;

                            }


                    }


                    // get blockHeight of transaction
                    console.log('blockhash: ' + res.blockhash);
                    self.getBlock(res.blockhash, function(err, res) {

                        if(err) cb(err, null);
                        console.log(res);

                        // query store API for receiver_id


                    });
                }


            })


        }, opts.pollingInterval);

    };

    Checkout.prototype.resetCurrency = function() {
        var cachedPrice = this._cachedPrice;

        if (this.checkoutActive) {

            // TODO -- pull function into .init function

            jQuery('.amount').each(function() {

                jQuery(this).html(cachedPrice);

                this.checkoutActive = false;

            });

        }
    };

    Checkout.prototype.setCurrency = function() {
        var self = this;

        var opts = { expiry: 300 }; // price expiry = 5 minutes

        if (!this.checkoutActive) {

            this.getExchangeRate(opts, function(err, res) {

                // TODO -- pull function into .init function

                jQuery('#order_review .amount').each(function() {

                    var price = Number(jQuery(this).text().replace(/[^0-9\.]+/g,""));
                    var dashPrice = parseFloat(price/res.value).toFixed(2);

                    self._cachedPrice = jQuery(this).html();

                    jQuery(this).html(dashPrice + ' <span class="woocommerce-Price-currencySymbol"> DASH</span> <div class="siteCurrency">' + self._cachedPrice + '</div>');

                    self.checkoutActive = true;

                });

            });

        }
    };
    
    // display QR code
    Checkout.prototype.displayQRCode = function(uri, cb) {


        var QRCode = uri;

        cb(null, QRCode);
    };


    // API


    Checkout.prototype.getChainTip = function(opts, cb) {
        var self = this;

        // fetch new exchange rate
        this.getBestBlockHash(function(err, res) {
            if(err) cb(err, null);
            self.getBlock(res.bestblockhash, function(err, res) {
                if(err) cb(err, null);
                cb(null, res); // return blockchain tip
            });
        });
    };

    Checkout.prototype.getFiatValue = function(fiatCode, cb) {

        var opts = {
            type: "POST",
            route: "/dash-payment-processor/valuationService",
            data: {
                fiatCode: fiatCode
            }
        };

        this._fetch(opts, cb);
    };



    Checkout.prototype.getTx = function(txid, cb) {

        var opts = {
            type: "GET",
            route: "/insight-api-dash/tx/"+txid,
            data: {
                format: "json"
            }
        };

        this._fetch(opts, cb);
    };

    Checkout.prototype.getBestBlockHash = function(cb) {

        var opts = {
            type: "GET",
            route: "/insight-api-dash/status?q=getBestBlockHash",
            data: {
                format: "json"
            }
        };

        this._fetch(opts, cb);
    };

    Checkout.prototype.getBlock = function(hash, cb) {

        var opts = {
            type: "GET",
            route: "/insight-api-dash/block/"+hash,
            data: {
                format: "json"
            }
        };

        this._fetch(opts, cb);
    };



    Checkout.prototype._fetch = function(opts,cb) {
        var self = this;
        var provider = opts.provider || self.provider;

        if(opts.type && opts.route && opts.data) {

            jQuery.ajax({
                type: opts.type,
                url: provider + opts.route,
                data: JSON.stringify(opts.data),
                contentType: "application/json; charset=utf-8",
                crossDomain: true,
                dataType: "json",
                success: function (data, status, jqXHR) {
                    cb(null, data);
                },
                error: function (jqXHR, status, error) {
                    var err = eval("(" + jqXHR.responseText + ")");
                    cb(err, null);
                }
            });

        } else {
            cb('missing parameter',null);
        }
    };

    
// })(jQuery);
