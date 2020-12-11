/**
 * CRI-17851.
 * Se crea el componente. Esta clase permite interactuar con el BAC Desktop que se encuentra
 * instalado en la maquina local del usuario.
 *
 * @author darcia
 * @since 2016-05-08
 * @version 1.0
 *
 * */
var DesktopClient = Stapes.subclass({

    constructor : function(){
        this.MINIMUN_CHROME_VERSION = 55;
        this.MINIMUN_FIREFOX_VERSION = 50;
        this.MINIMUN_IE_VERSION = 10;
        this.MINIMUN_OPERA_VERSION = 42;
        this.TIME_OUT = 30;
        this.isRetry=true;

        //URL del servicio del BACDesktop
        this.DESKTOP_SERVICE = bacSignService;

		this.triggerLinkId = "BACDesktop"+new Date().getTime();
        this.modalId = this.triggerLinkId+'modal';
		this.modalWarningId = this.triggerLinkId+'warning';

        this.browserUtils = BrowserUtils(window);

		var link = $("<a id='"+this.triggerLinkId+"' href='#'></a>");
	    $("body").prepend(link);

    },

    /**
     * Metodo generico para despachar un callback
     * */
    dispatchCallback: function(callback, data){
        if(callback){
            callback.call(this, data);
        }
    },

    /**
     * Realiza un request para obtener una sesion con el BAC Desktop
     * */
     sendRequest: function(message, callback){
        var browserName = this.browserUtils.getBrowserVersion().name;
        var browserVersion = this.browserUtils.getBrowserVersion().version;
        var isIncompatibleBrowser = false;
        switch(browserName){
            case "chrome":

                if (browserVersion < this.MINIMUN_CHROME_VERSION){
                   isIncompatibleBrowser = true;
                }
                break;

            case "firefox":
                if (browserVersion < this.MINIMUN_FIREFOX_VERSION){
                    isIncompatibleBrowser = true;
                }
                break;

            case "ie":
                if (browserVersion < this.MINIMUN_IE_VERSION){
                    isIncompatibleBrowser = true;
                }
                break;

            case "opera":
                if (browserVersion < this.MINIMUN_OPERA_VERSION){
                    isIncompatibleBrowser = true;
                }
                break;

        }

        if (isIncompatibleBrowser){
            this.browserUtils.showHeaderMessage(msg019);
            return; //Detiene el flujo normal.
        }


        var self = this;
		 //Valida el request
        //Muestra un loader y espera por la interveci�n del usuario
        self.browserUtils.showLoader(function(onUserNotReponse){

        	self.isRetry=true;

	       	 if(!message){
	       		self.dispatchCallback(callback);
			 }

			 if(!message.module){
				 self.dispatchCallback(callback);
			 }

	        if(!message.operationCode){
	        	self.dispatchCallback(callback);
	        }

	        if(!message.userName){
	        	self.dispatchCallback(callback);
	        }

	        if(!message.tramitId){
	            message.tramitId = new Date().getTime();
	        }

	        //Verifica si el llamado es modal
	        var modal = message.modal;
	        if(modal){
	            $("#"+this.modalId).modal({
	                backdrop: 'static',
	                keyboard: false
	            });
	        }

	        //Pasa el objeto a string, para adjuntarlo al URI del schema
	        var requestString = JSON.stringify(message);
	        requestString = requestString.replace(/"/g, '\\"');
	        requestString = "\"" + requestString + "\"";

	        //Hace un encode de los datos para poder utilizarla de URI
	        requestString = window.btoa(requestString);
	        try{
	        	var url = "bacdesktop:"+requestString;
				$("#bacdesktopIframe").remove();
				$(document.body).append("<iframe id='bacdesktopIframe' style='display:none;' src='"+ url+ "'/>");
	        }catch(ex){
	        	alert(ex);
	        }
	        //Vanilla JS dado que jQuery no soporta el click del link
	        //document.getElementById(self.triggerLinkId).click();
	        //Ejecuta el consultado de la respuesta
	        setTimeout(function(){

	            self.getResponse(message, function(response){
	            	if(!response){
	            		onUserNotReponse();
	            	}
	                self.dispatchCallback(callback, response);
	            });


	        }, 2000);
        }, this.isRetry);

    },

    /**
     * Consulta por la respuesta
     * */
     getResponse: function(message, callback){
        //Metodo que se encarga de obtener la respuesta del desktop
        this.waitForAnswer(message, 0, callback);
     },

    /**
     * Metodo que se encarga de obtener la respuesta del desktop
     * */
    waitForAnswer: function(message, iterationCounter, callback){
        var self = this;
        var module = message.module;
        var tramitId = message.tramitId;
        if(iterationCounter >= 35){
			self.dispatchCallback(callback);
            return false;
        }
        var url = this.DESKTOP_SERVICE + "?module="+module+"&tramitId="+tramitId;
        jQuery.support.cors = true;
        $.ajax({
            url: url,
            data: "",
            type: "GET",
            timeout: 10000,
            dataType: "text",
            success: function(data) {
                try{
                    if(data){
                        var response = JSON.parse(data);
                        if(response.resultCode == "-1"){
                            if(iterationCounter < self.TIME_OUT){
                                //reintenta
                                setTimeout(function(){
                                    iterationCounter++;
                                    self.waitForAnswer(message, iterationCounter, callback);
                                },2000);
                            }else{
								self.dispatchCallback(callback);
                            }
                        }else{
                            if(response.resultCode == "-2"){
								self.dispatchCallback(callback);
                            }else{
                                //Verifica si trae resultcontenr
                                try{
                                    if(response.resultContent){
                                        var content = JSON.parse(response.resultContent);
                                        response.resultContent = content;
                                        self.browserUtils.closeLoader();
                                    }
                                }catch(e){
                                }
                                self.dispatchCallback(callback, response);
                            }
                        }
                    }
                }catch(e){

                    self.dispatchCallback(callback);
                }
            },
            error: function(jqXHR, textStatus, ex) {
            	self.browserUtils.closeLoader();
            	setTimeout(function(){
            		alert(msg000);
            	}, 1000);


            }
        });
    },

    /**
     * Consulta por la respuesta
     * */
     sendTramitToSign: function(serviceMessage, startSigningProcessCallback, desktopMessage, onError){

    	//Pasa el objeto a string, para adjuntarlo al URI del schema
	      var requestString = JSON.stringify(serviceMessage);
	      var self = this;
          jQuery.support.cors = true;
          $.ajax({
              url: this.DESKTOP_SERVICE,
              data: requestString,
              type: "POST",
              contentType: "application/json",
              dataType: "json",
              timeout: 10000,
              success: function() {
            	  //console.log("Response: Listo");
            	  startSigningProcessCallback(desktopMessage);
              },
              error: function(jqXHR, textStatus, ex) {
            	console.log(jqXHR);
            	console.log(textStatus);
              	self.browserUtils.closeLoader();
              	setTimeout(function(){
              		console.error(msg000);
              		if(onError){
              			onError();
              		}

              	}, 1000);
              }
          });
     }

});
