# ApexProject

Oracle APEX 프로젝트의 애플리케이션 소스 및 관련 설정 파일을 백업하고 관리하기 위한 GitHub 저장소입니다.

## 📁 폴더 구성

| 폴더 | 설명 |
|---|---|
| **application** | Oracle APEX 애플리케이션 Export SQL 백업 파일 |
| **rest** | Oracle APEX RESTful Data Services 관련 설정 및 REST API 정의 백업 파일 |
| **static Files** | Oracle APEX Workspace 및 Application Static Files 백업 파일 (JavaScript, CSS, 이미지 등) |

## 📋 백업 항목 상세

### 1. application

Oracle APEX에서 개발한 애플리케이션의 Export 파일을 관리합니다.

- 애플리케이션 페이지 및 컴포넌트
- Dynamic Actions 및 Processes
- Shared Components
- 애플리케이션 설정 및 관련 SQL 소스

### 2. rest

Oracle APEX 및 ORDS 환경에서 사용하는 RESTful Services 관련 백업 파일을 관리합니다.

- RESTful Services 설정
- REST API 모듈 및 엔드포인트 정의
- REST API Handler 관련 SQL 및 PL/SQL

### 3. static Files

Oracle APEX에서 사용하는 정적 리소스 파일을 관리합니다.

- **Workspace Static Files** : Workspace 공통 리소스
- **Application Static Files** : 애플리케이션별 리소스
- JavaScript, CSS, 이미지 등 정적 파일

## 🔄 백업 관리

- Oracle APEX에서 Export한 파일을 각 폴더에 분류하여 관리합니다.
- 백업 파일 변경 시 Git Commit을 통해 변경 이력을 기록합니다.
- GitHub의 버전 관리 기능을 활용하여 이전 백업 내역을 확인할 수 있습니다.

## ⚠️ 참고 사항

본 저장소는 Oracle APEX 애플리케이션 및 관련 소스 파일의 백업을 목적으로 합니다.

- 데이터베이스 테이블 데이터 및 별도 DB 객체는 백업 범위에 포함되지 않을 수 있습니다.
- 애플리케이션 복원 시 Oracle APEX 및 ORDS 환경의 설정과 버전 호환성을 확인해야 합니다.
- 비밀번호, API Key 등 민감한 정보는 저장소에 업로드하지 않습니다.
