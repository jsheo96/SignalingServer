# SignalingServer

이 프로그램은 FishScope의 모니터링 기능을 위한 기술인 WebRTC의 시그널링 서버입니다.

# Introduction
WebRTC 기술은 단말간 실시간 영상 통화를 가능하게 합니다.
단말간의 영상정보 교환 및 통신 경로 협상을 위해서는 시그널링 서버가 반드시 필요합니다.

해당 프로젝트에서 구현하는 시그널링 서버는 다음을 수행합니다.
- 카메라 또는 단말의 연결을 기다리기
- 단말 간의 join 신호 중계하기
- 단말 간의 offer 신호 중계하기
- 단말 간의 disconnect 신호 중계하기

# Usage
```
$ git clone git@github.com/jsheo96/SignalingServer.git
$ cd SignalingServer
$ npm install
$ node sig_server.js
```
Docker가 설치되어 있다면 다음 명령을 통해 간단히 실행할 수 있습니다.
```
$ docker run --name sig-server --network host jsheo96/sig-server:latest
```

