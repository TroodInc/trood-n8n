# Openvidu Platform deployment

> **IMPORTANT NOTE:** This procedure is in development an can change in any moment. Please use it with care and visit the page with frecuency.

This document describes how to deploy OpenVidu Platform. It allows also to deploy OpenVidu Call videoconference application. 

OpenVidu Platform is deployed as a set of docker containers managed with a docker-compose (Kubernetes Helm chart is in the works). Docker basic knowledge is not required, but recommended. 

This procedure installs the following services:
- **OpenVidu Server (openvidu-server)**: This is the brain of OpenVidu platform. The signaling plane.
- **Kurento Media Server (kms)**: This is the hearth of the OpenVidu platform. In charge of media plane.
- **Coturn (coturn)**: Service used to allow media communications with browsers in certain special networks.
- **Redis (redis)**: Database to manage users in Coturn server.
- **Nginx (nginx)**: A reverse proxy used to configure SSL certificate and to allow both Openvidu Server and the Application in the standard https port (443).
- **Videoconference Application (app)**: OpenVidu Call application or any other application. Can be disabled.

## 1. Prerequisites

OpenVidu Platform can only be installed in Linux. Mac and Windows is not supported for production use. If you want to develop in Mac or Windows, please follow the [tutorials](https://docs.openvidu.io/en/2.12.0/tutorials/) to see how to execute OpenVidu in a single docker container.

You can use any modern Linux distribution supported by docker. We have tested with Ubuntu 18.04.

You will need docker and docker-compose installed in your linux distribution.

- [Install Docker](https://docs.docker.com/install/linux/docker-ce/ubuntu/)
- [Install Docker Compose](https://docs.docker.com/compose/install/)

Open ports:
- 22 TCP: To connect using SSH to admin OpenVidu.
- 80 TCP: If you select Let's Encrypt to generate an SSL certificate this port is used by the generation process.
- 443 TCP: OpenVidu server and application are published in standard https port.
- 3478 TCP: Used by TURN Server to stablish media connections.
- 3478 UDP: Used by TURN Server to stablish media connections.
- 40000 - 57000 UDP: Ports used by Kurento Media Server to stablish media connections.
- 57001 - 65535 UDP: Used by TURN Server to stablish media connections.

It is important to have a **domain name** pointing to the machine where you are are going to deploy OpenVidu. The platform is deployed using https because is mandatory to use WebRTC. Then, if you do not have a domain name, an ugly warning will appear to your users when enter to your site. And, of course, you can suffer a man in the middle attack. You don't need a valid SSL certificate as one can be created by Let's Encrypt in the installation process.

## 2. Deployment

Execute the following command to download and execute the installation script:

`curl https://raw.githubusercontent.com/OpenVidu/openvidu/master/openvidu-server/docker/openvidu-docker-compose/install_openvidu.sh | bash`

It will donwload all required files into `openvidu` folder and will show this message with basic instructions:

```

   Openvidu Platform successfully installed.

   1. Go to openvidu folder:
   $ cd openvidu

   2. Configure DOMAIN_OR_PUBLIC_IP and OPENVIDU_SECRET in .env file:
   $ nano .env

   3. Start OpenVidu
   $ ./openvidu start

   For more information, check readme.md

```


## 3. Configuration

OpenVidu Platform configuration is specified in the `.env` file with environment variables. 

**YOU MUST** specify the **DOMAIN_OR_PUBLIC_IP** of the machine and the **OPENVIDU_SECRET**. They are empty and execution will fail if you do not specify them. 

If you have a domain name, generate a certificate with Let's Encrypt or put your own certificate. 

All other configuration properties comes with sane defaults.

The `.env` file looks like this:
```
# OpenVidu configuration
# ----------------------
# Documentation: https://docs.openvidu.io/en/stable/reference-docs/openvidu-config/

# NOTE: This file doesn't need to quote assignment values, like most shells do.
# All values are stored as-is, even if they contain spaces, so don't quote them.

# Domain name. If you do not have one, the public IP of the machine.
# For example: 198.51.100.1, or openvidu.example.com
DOMAIN_OR_PUBLIC_IP=

# OpenVidu SECRET used for apps to connect to OpenVidu server and users to access to OpenVidu Dashboard
OPENVIDU_SECRET=

# Certificate type:
# - selfsigned:  Self signed certificate. Not recommended for production use.
#                Users will see an ERROR when connected to web page.
# - owncert:     Valid certificate purchased in a Internet services company.
#                Please put the certificates files inside folder ./owncert
#                with names certificate.key and certificate.cert
# - letsencrypt: Generate a new certificate using letsencrypt. Please set the
#                required contact email for Let's Encrypt in LETSENCRYPT_EMAIL
#                variable.
CERTIFICATE_TYPE=selfsigned

# If CERTIFICATE_TYPE=letsencrypt, you need to configure a valid email for notifications
LETSENCRYPT_EMAIL=user@example.com

...
```

> **NOTE:** If you want to try OpenVidu in your linux development machine:
> * If you set `DOMAIN_OR_PUBLIC_IP=localhost` then in your browser you have to use `https://localhost/`. If you use `https://127.0.0.1/` instead, you will have some issues.
> * OpenVidu services will use some host ports that have to be available: 80, 3478, 5442, 5443, 8888 and 6379.

### Videoconference application

By default, the [OpenVidu Call application](https://docs.openvidu.io/en/stable/demos/openvidu-call/) is deployed alongside OpenVide Platform. It is accessible in the URL:

```
https://DOMAIN_OR_PUBLIC_IP/
```

This application is defined in the file `docker-compose.override.yml`.

To disable OpenVidu Call application, you can delete  the file `docker-compose.override.yml` (or renaming it in case you want to enable again in the future).

You can configure any other application updating the content of `docker-compose.override.yml` with the following requirements:
* Application server port must to be binded to 5442 in the host, as this port is used by NGINX to publish your app in port default https port (443).
* The application must be served in plain http as NGINX is the responsible of managing SSL certificate.
* Application has to know OpenVidu Server URL. You can use the variables ${DOMAIN_OR_PUBLIC_IP} and ${OPENVIDU_SECRET} in `docker-compose.override.yml` file.
* The application and OpenVidu platform are deployed in the same domain. For that reason, the following URLs are reserved for OpenVidu and you cannot use them in the application:
  * `/api/`
  * `/openvidu/`
  * `/dashboard/`

## 4. Execution

To start OpenVidu Platform (and the application if enabled) you can execute this command:

```
$ ./openvidu start
```

Then, all docker images for services will be downloaded (only the first time) and executed.

The first part of the log shows how to docker-compose command execute all services:

```
Creating openvidu-docker-compose_coturn_1          ... done
Creating openvidu-docker-compose_app_1             ... done
Creating openvidu-docker-compose_kms_1             ... done
Creating openvidu-docker-compose_nginx_1           ... done
Creating openvidu-docker-compose_redis_1           ... done
Creating openvidu-docker-compose_openvidu-server_1 ... done
```

Then, `openvidu-server` service logs are shown. 

When OpenVidu Platform is ready you will see this message:
```
----------------------------------------------------

   OpenVidu Platform is ready!
   ---------------------------

   * OpenVidu Server: https://server/

   * OpenVidu Dashboard: https://server/dashboard/

----------------------------------------------------
```

You can press `Ctrl+C` to come back to the shell and OpenVidu will be executed in the background.

If the application is enabled, it is available in `https://server/`.

You can open OpenVidu Dashboard to verify if the platform is working as expected go to `https://server/dashboard/` with credentials:
* user: OPENVIDUAPP
* password: the value of OPENVIDU_SECRET in `.env` file.

## 6. Stop execution

To stop the platform execute:

```
$ ./openvidu stop
```

## 6. Changing configuration

To change the configuration:
* Change configuration in `.env` file
* Restart the service with command:

```
$ ./openvidu restart
```

## 7. Rest API

All REST operations have in common the header referred to authorization. 
It is implemented via Basic Auth, and it is as simple as applying Base64 
encoding to the username (always "OPENVIDUAPP") and the password (the value of OPENVIDU_SECRET in `.env` file). 
If authorization header is wrong, every call to any REST API operation will return HTTP status 401.

* role: (optional string. Check OpenViduRole section of OpenVidu Node Client for a complete description)
    * SUBSCRIBER
    * PUBLISHER (**default**)
    * MODERATOR

### POST /api/sessions

Initialize a session.

|   |   |
|---|---|
|Content-Type| application/json|
|Authorization|Basic EncodeBase64(OPENVIDUAPP:<YOUR_SECRET>)|
|   |   |

Request

```
{
    "recordingMode": "RECORDING_MODE", 
    "customSessionId": "CUSTOM_SESSION_ID", 
    "defaultOutputMode": "OUTPUT_MODE", 
    "defaultRecordingLayout": "RECORDING_LAYOUT", 
    "defaultCustomLayout": "CUSTOM_LAYOUT"
}
```

Response

```
{
    "id": "zfgmthb8jl9uellk", 
    "createdAt": 1538481996019
}
```

### POST /api/tokens

Generate a token.

|   |   |
|---|---|
|Content-Type| application/json|
|Authorization|Basic EncodeBase64(OPENVIDUAPP:<YOUR_SECRET>)|
|   |   |

Request

```
{
    "session": "SESSION_ID", 
    "role": "ROLE", 
    "data": "DATA", 
    "kurentoOptions": KURENTO_OPTIONS
}
```

Response

```
{
    "id":"wss://localhost:4443?sessionId=zfgmthb8jl9uellk&token=lnlrtnkwm4v8l7uc&role=PUBLISHER&turnUsername=FYYNRC&turnCredential=yfxxs3", 
    "session": "zfgmthb8jl9uellk", 
    "role": "PUBLISHER", 
    "data": "User Data", 
    "token":"wss://localhost:4443?sessionId=zfgmthb8jl9uellk&token=lnlrtnkwm4v8l7uc&role=PUBLISHER&turnUsername=FYYNRC&turnCredential=yfxxs3", 
    "kurentoOptions": 
    {
        "videoMaxSendBandwidth": 700, 
        "allowedFilters": ["GStreamerFilter", "ZBarFilter"]
    }
}
```

### GET /api/sessions/<SESSION_ID>

Get a session.

|   |   |
|---|---|
|Content-Type| application/json|
|Authorization|Basic EncodeBase64(OPENVIDUAPP:<YOUR_SECRET>)|
|   |   |

Response

```
{
    "sessionId":"TestSession",
    "createdAt":1538482606338,
    "mediaMode":"ROUTED",
    "recordingMode":"MANUAL",
    "defaultOutputMode":"COMPOSED",
    "defaultRecordingLayout":"BEST_FIT",
    "customSessionId":"TestSession",
    "connections":
    {
        "numberOfElements":2,
        "content":[
        {
            "connectionId":"vhdxz7abbfirh2lh",
            "createdAt":1538482606412,
            "location":"",
            "platform":"Chrome 69.0.3497.100 on Linux 64-bit",
            "token":"wss://localhost:4443?sessionId=TestSession&token=2ezkertrimk6nttk&role=PUBLISHER&turnUsername=H0EQLL&turnCredential=kjh48u",
            "role":"PUBLISHER",
            "serverData":"",
            "clientData":"TestClient1",
            "publishers":[
            {
                "createdAt":1538482606976,
                "streamId":"vhdxz7abbfirh2lh_CAMERA_CLVAU",
                "mediaOptions":
                {
                    "hasAudio":true,
                    "audioActive":true,
                    "hasVideo":true,
                    "videoActive":true,
                    "typeOfVideo":"CAMERA",
                    "frameRate":30,
                    "videoDimensions":"{\"width\":640,\"height\":480}",
                    "filter":{}
                }
            }],
            "subscribers":[]
        },
        {
            "connectionId":"maxawd3ysuj1rxvq",
            "createdAt":1538482607659,
            "location":"",
            "platform":"Chrome 69.0.3497.100 on Linux 64-bit",
            "token":"wss://localhost:4443?sessionId=TestSession&token=ovj1b4ysuqmcirti&role=PUBLISHER&turnUsername=INOAHN&turnCredential=oujrqd",
            "role":"PUBLISHER",
            "serverData":"",
            "clientData":"TestClient2",
            "publishers":[],
            "subscribers":[
            {
                "createdAt":1538482607799,
                "streamId":"vhdxz7abbfirh2lh_CAMERA_CLVAU",
                "publisher":"vhdxz7abbfirh2lh"
            }]
        }]
    },
    "recording":false
}
```

### GET /api/sessions

Get an all sessions.

|   |   |
|---|---|
|Content-Type| application/json|
|Authorization|Basic EncodeBase64(OPENVIDUAPP:<YOUR_SECRET>)|
|   |   |

Response

```
{
    "numberOfElements":1,
    "content":[
    {
        "sessionId":"TestSession",
        "createdAt":1538482606338,
        "mediaMode":"ROUTED",
        "recordingMode":"MANUAL",
        "defaultOutputMode":"COMPOSED",
        "defaultRecordingLayout":"BEST_FIT",
        "customSessionId":"TestSession",
        "connections":
        {
            "numberOfElements":2,
            "content":[
            {
                "connectionId":"vhdxz7abbfirh2lh",
                "createdAt":1538482606412,
                "location":"",
                "platform":"Chrome 69.0.3497.100 on Linux 64-bit",
                "token":"wss://localhost:4443?sessionId=TestSession&token=2ezkertrimk6nttk&role=PUBLISHER&turnUsername=H0EQLL&turnCredential=kjh48u",
                "role":"PUBLISHER",
                "serverData":"",
                "clientData":"TestClient1",
                "publishers":[
                {
                    "createdAt":1538482606976,
                    "streamId":"vhdxz7abbfirh2lh_CAMERA_CLVAU",
                    "mediaOptions":
                    {
                        "hasAudio":true,
                        "audioActive":true,
                        "hasVideo":true,
                        "videoActive":true,
                        "typeOfVideo":"CAMERA",
                        "frameRate":30,
                        "videoDimensions":"{\"width\":640,\"height\":480}",
                        "filter":{}
                    }
                }],
                "subscribers":[]
            },
            {
                "connectionId":"maxawd3ysuj1rxvq",
                "createdAt":1538482607659,
                "location":"",
                "platform":"Chrome 69.0.3497.100 on Linux 64-bit",
                "token":"wss://localhost:4443?sessionId=TestSession&token=ovj1b4ysuqmcirti&role=PUBLISHER&turnUsername=INOAHN&turnCredential=oujrqd",
                "role":"PUBLISHER",
                "serverData":"",
                "clientData":"TestClient2",
                "publishers":[],
                "subscribers":[
                {
                    "createdAt":1538482607799,
                    "streamId":"vhdxz7abbfirh2lh_CAMERA_CLVAU",
                    "publisher":"vhdxz7abbfirh2lh"
                }]
            }]
        },
        "recording":false
    }]
}
```

### POST /api/signal

Send a signal to a session.

|   |   |
|---|---|
|Content-Type| application/json|
|Authorization|Basic EncodeBase64(OPENVIDUAPP:<YOUR_SECRET>)|
|   |   |

Request

```
{
    "session": "SESSION_ID", 
    "to": ["connectionId1", "connectionId2"], 
    "type": "MY_TYPE", 
    "data": "This is my signal data"
}
```

### DELETE /api/sessions/<SESSION_ID>

Close a session.

|   |   |
|---|---|
|Content-Type| application/json|
|Authorization|Basic EncodeBase64(OPENVIDUAPP:<YOUR_SECRET>)|
|   |   |

### DELETE /api/sessions/<SESSION_ID>/connection/<CONNECTION_ID>

Force the disconnection of a user from a session.

|   |   |
|---|---|
|Content-Type| application/json|
|Authorization|Basic EncodeBase64(OPENVIDUAPP:<YOUR_SECRET>)|
|   |   |

### DELETE /api/sessions/<SESSION_ID>/stream/<STREAM_ID>

Force the unpublishing of a user's stream from a session.

|   |   |
|---|---|
|Content-Type| application/json|
|Authorization|Basic EncodeBase64(OPENVIDUAPP:<YOUR_SECRET>)|
|   |   |

###  POST /api/sessions/<SESSION_ID>/connection

Publish a stream from an IP camera.

|   |   |
|---|---|
|Content-Type| application/json|
|Authorization|Basic EncodeBase64(OPENVIDUAPP:<YOUR_SECRET>)|
|   |   |

Request

```
{
    "type": "IPCAM", 
    "rtspUri": "rtsp://b1.dnsdojo.com:1935/live/sys3.stream", 
    "adaptativeBitrate": true, 
    "onlyPlayWithSubscribers": true, 
    "data": "Office security camera"
}
```

Response

```
{
    "connectionId": "ipc_IPCAM_rtsp_A8MJ_91_191_213_49_554_live_mpeg4_sdp", 
    "createdAt": 1582121476379, 
    "location": "unknown", 
    "platform": "IPCAM", 
    "role": "PUBLISHER", 
    "serverData": "MY_IP_CAMERA", 
    "publishers": [
    {
        "createdAt": 1582121476439, 
        "streamId": "str_IPC_XC1W_ipc_IPCAM_rtsp_A8MJ_91_191_213_49_554_live_mpeg4_sdp", 
        "rtspUri": "rtsp://91.191.213.49:554/live_mpeg4.sdp", 
        "mediaOptions": 
        {
            "hasAudio": true, 
            "audioActive": true, 
            "hasVideo": true, 
            "videoActive": true, 
            "typeOfVideo": "IPCAM", 
            "frameRate": null, 
            "videoDimensions": null, 
            "filter": {}, 
            "adaptativeBitrate": true, 
            "onlyPlayWithSubscribers": true
        }
    } ], 
    "subscribers": []
}
```

### POST /api/recordings/start

Start the recording of a session.

|   |   |
|---|---|
|Content-Type| application/json|
|Authorization|Basic EncodeBase64(OPENVIDUAPP:<YOUR_SECRET>)|
|   |   |

Request

```
{
    "session": "SESSION_ID", 
    "name": "NAME", 
    "outputMode": "OUTPUT_MODE", 
    "hasAudio": "HAS_AUDIO", 
    "hasVideo": "HAS_VIDEO", 
    "resolution": "RESOLUTION", 
    "recordingLayout": "RECORDING_LAYOUT", 
    "customLayout": "CUSTOM_LAYOUT"
}
```

Response

```
{
    "id": "fds4e07mdug1ga3h", 
    "sessionId": "fds4e07mdug1ga3h", 
    "name": "MyRecording", 
    "outputMode": "COMPOSED", 
    "hasAudio":true, 
    "hasVideo":false,
    "createdAt":1538483606521, 
    "size":3205004, 
    "duration":12.92, 
    "url":null, 
    "status": "started"
}
```

### POST/api/recordings/stop/<RECORDING_ID>

Stop the recording of a session.

|   |   |
|---|---|
|Content-Type| application/json|
|Authorization|Basic EncodeBase64(OPENVIDUAPP:<YOUR_SECRET>)|
|   |   |

Response

```
{
    "id": "fds4e07mdug1ga3h", 
    "sessionId": "fds4e07mdug1ga3h", 
    "name": "MyRecording", 
    "outputMode": "COMPOSED", 
    "hasAudio": true, 
    "hasVideo": false, 
    "createdAt": 1538483606521, 
    "size": 3205004, 
    "duration": 12.92, 
    "url": null, 
    "status": "stopped"
}
```

### GET /api/recordings/<RECORDING_ID>

Get recording info

|   |   |
|---|---|
|Content-Type| application/json|
|Authorization|Basic EncodeBase64(OPENVIDUAPP:<YOUR_SECRET>)|
|   |   |

Response

```
{
    "id": "fds4e07mdug1ga3h", 
    "sessionId": "fds4e07mdug1ga3h", 
    "name": "MyRecording", 
    "outputMode": "COMPOSED", 
    "hasAudio": true, 
    "hasVideo": false, 
    "createdAt": 1538483606521, 
    "size": 3205004, 
    "duration": 12.92, 
    "url": null, 
    "status": "stopped"
}
```

### GET /api/recordings

Get all recordings info.

|   |   |
|---|---|
|Content-Type| application/json|
|Authorization|Basic EncodeBase64(OPENVIDUAPP:<YOUR_SECRET>)|
|   |   |

Response

```
{
    "count": 2, 
    "items": [
    {
        "id": "n0kcws1evvn3esmo", 
        "sessionId": "n0kcws1evvn3esmo", 
        "name": "n0kcws1evvn3esmo", 
        "outputMode": "COMPOSED", 
        "hasAudio": true, 
        "hasVideo": true, 
        "recordingLayout": "BEST_FIT", 
        "resolution": "1920x1080", 
        "createdAt": 1521202349460, 
        "size": 22887561, 
        "duration": 132.08, 
        "url": "https://localhost:4443/recordings/n0kcws1evvn3esmo/n0kcws1evvn3esmo.mp4", 
        "status": "available"
    }, 
    {
        "id": "fds4e07mdug1ga3h", 
        "sessionId": "fds4e07mdug1ga3h", 
        "name": "MyRecording", 
        "outputMode": "COMPOSED", 
        "hasAudio": true, 
        "hasVideo": false, 
        "createdAt": 1538483606521, 
        "size": 3205004, 
        "duration": 12.92, 
        "url": "https://localhost:4443/recordings/fds4e07mdug1ga3h/MyRecording.webm", 
        "status": "available"
    }]
}
```

### DELETE /api/recordings/<RECORDING_ID>

Delete a recording.

|   |   |
|---|---|
|Content-Type| application/json|
|Authorization|Basic EncodeBase64(OPENVIDUAPP:<YOUR_SECRET>)|
|   |   |

## 5. Problems

### Configuration errors

If you have any problem with the configuration, when you start OpenVidu the following report will be shown:

```
 
    Configuration errors
    --------------------
 
    * Property OPENVIDU_SECRET is not set. Cannot be empty.
    * Property DOMAIN_OR_PUBLIC_IP is not set. Cannot be empty
 
 
    Fix config errors
    ---------------
 
    1) Return to shell pressing Ctrl+C
    2) Set correct values in '.env' configuration file
    3) Restart OpenVidu with:
 
       $ ./openvidu restart

```

### Docker compose

To solve any other issue, it is important to understand how openvidu is executed. 

OpenVidu is executed as a docker-compose file. The commands executed by the script are the standard docker-compose commands:

* start
  * `$ docker-compose up -d`
  * `$ docker-compose logs -f openvidu-server`
* stop
  * `$ docker-compose down` 
* restart
  * `$ docker-compose down` 
  * `$ docker-compose up -d`
  * `$ docker-compose logs -f openvidu-server`
* logs
  * `$ docker-compose logs -f openvidu-server`
 
As you can see, logs of `openvidu-server` service are shown when platform is started or restarted. This log contains the most important information for the OpenVidu execution.

### Show service logs

Take a look to service logs to see what happen. First, see openvidu-server logs:

```
$ ./openvidu logs
```

Then, you can see all service logs togheter: 

`$ docker-compose logs -f`

Or you can inspect one by one the other services:

```
$ docker-compose logs -f kms
$ docker-compose logs -f nginx
$ docker-compose logs -f coturn
$ docker-compose logs -f redis
$ docker-compose logs -f app
```
### Review the configuration

Sometimes, we can have a typo when writing a property name. For this reason, openvidu-server print in the log all the configuration properties you are configured in `.env` file and the default values for all other config properties. In that way, you can double check what openvidu-server *see*.

If `openvidu-server` detects some error, it will show it in the log.

```
   Configuration properties
   ---------------------  
   * CERTIFICATE_TYPE=selfsigned
   * OPENVIDU_CDR=false
   * OPENVIDU_CDR_PATH=/opt/openvidu/cdr
   * DOMAIN_OR_PUBLIC_IP=my.domain.com
   * OPENVIDU_RECORDING=false
   * OPENVIDU_RECORDING_AUTOSTOP-TIMEOUT=120
   * OPENVIDU_RECORDING_COMPOSED-URL=

...
```

### Java options

To use java options in openvidu-server change the property `JAVA_OPTIONS` in configuration file `.env`

For more information about posible values for java option visit [Configuring Java Options](https://docs.oracle.com/cd/E37116_01/install.111210/e23737/configuring_jvm.htm#OUDIG00007)


### Change log level of the services

To change the level of `openvidu-server` logs change the property `OV_CE_DEBUG_LEVEL`.

To change the level of Kurento Media Server `kms` logs change the property `KMS_DEBUG_LEVEL`. For more information about possible values visit https://doc-kurento.readthedocs.io/en/stable/features/logging.html

### Change Kurento Media Server docker image

OpenVidu and Kurento Media Server evolves at different rithm. Sometimes, it is possible that a new KMS is released but OpenVidu is not still updated. In that case, in case you hit a bug and that bug is solved in last KMS version, you can test if updating only KMS is working for you. `KMS_IMAGE` property allows you to specify the new KMS image.
