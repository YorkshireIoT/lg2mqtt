const loginForm = document.getElementById("login-form");
const loginButton = document.getElementById("login-form-submit");
const loginErrorMsg = document.getElementById("login-error-msg");
const loginErrorTitle = document.getElementById("login-error-title");

loginButton.addEventListener("click", (e) => {
    e.preventDefault();
    console.log("Saving config...")
    webOS.service.request('luna://com.palm.db', {
        method: 'put',
        parameters: {
            objects: [
                {
                    _kind: 'com.yorkshireiot.lg2mqtt:1',
                    host: loginForm.host.value,
                    port: loginForm.port.value,
                    username: loginForm.username.value,
                    password: loginForm.password.value
                },
            ],
        },
        onSuccess: function (inResponse) {
            console.log('Result: ' + JSON.stringify(inResponse));
            // Now the config is saved we can start the app
            start();
            // And navigate back to the home page
            window.location.replace("index.html");
        },
        onFailure: function (inError) {
            loginErrorTitle.textContent = "Internal app error saving config. Sorry!";
            loginErrorTitle.style.opacity = 1;
            loginErrorMsg.textContent = '[' + inError.errorCode + ']: ' + inError.errorText;
            loginErrorMsg.style.opacity = 1;
            return;
        },
    });

})