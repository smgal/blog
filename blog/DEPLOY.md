# 개인 블로그 배포 안내

이 문서는 `blog/` 개인 블로그를 Firebase Hosting과 Firestore에 배포하는 절차를 설명한다.

블로그는 기존 방명록과 같은 Firebase 프로젝트를 사용한다.

- Firebase 프로젝트: `smgal-com-guestbook`
- 기존 방명록 Hosting 사이트: `smgal-com-guestbook`
- 블로그 Hosting target: `blog`
- 블로그에 사용할 Hosting 사이트 ID: `smgal-com-blog`
- 예상 공개 주소: `https://smgal-com-blog.web.app`

> `.firebaserc`에 `blog → smgal-com-blog` target이 적혀 있어도 실제 Hosting 사이트가 생성된 것은 아니다. 사이트 생성 여부를 확인한 뒤 배포해야 한다.

## 1. 배포 전 준비

저장소 루트에서 명령을 실행한다.

```sh
cd /Users/user/_GIT/SMG_smgal-com_iris-nx_archive
```

Firebase CLI를 전역 설치하지 않아도 `npx firebase-tools`로 실행할 수 있다.

```sh
npx firebase-tools login
npx firebase-tools projects:list
```

토큰 만료가 되었다면 다음과 같이...
```sh
npx firebase-tools logout
npx firebase-tools login --reauth
```

프로젝트 목록에서 다음 두 프로젝트에 접근할 수 있는지 확인한다.

- `smgal-com-guestbook`: 방명록, 블로그, Firebase Auth, 블로그 Firestore
- `smgal-com-visits`: `smgal.com` 메인 Hosting과 방문 기록

## 2. 로컬 전용 파일 확인

다음 파일은 `.gitignore` 대상이므로 다른 PC에서는 직접 복사하거나 다시 만들어야 한다.

- `.firebaserc`
- `blog/firebase-config.js`
- `blog/firestore.rules`

### `blog/firebase-config.js`

다음 값이 실제 Firebase 프로젝트와 관리자 계정에 맞는지 확인한다.

```js
const firebaseConfig = {
  // smgal-com-guestbook Firebase 웹 앱 설정
};

const ADMIN_UID = "본인의 Google 로그인 UID";
const OWNER_NAME = "SMgal";
```

`ADMIN_UID`는 Firebase Console의 `Authentication → Users`에 표시되는 본인 계정 UID여야 한다.

### `blog/firestore.rules`

`isBlogAdmin()` 안의 UID가 `blog/firebase-config.js`의 `ADMIN_UID`와 같아야 한다.

```text
request.auth.uid == '본인의 Google 로그인 UID'
```

> `firebase-config.js`는 Git에 없는 파일이어도 로컬에 존재하면 Hosting 배포에 포함된다. 이 파일이 없으면 배포된 블로그에서 Firebase 초기화가 실패한다.

## 3. Firebase Authentication 확인

Firebase Console에서 `smgal-com-guestbook` 프로젝트를 열고 다음을 확인한다.

1. `Authentication → Sign-in method`에서 Google 로그인이 활성화되어 있어야 한다.
2. `Authentication → Users`에 관리자 Google 계정이 있어야 한다.
3. 로그인 시 `auth/unauthorized-domain` 오류가 발생하면 `Authentication → Settings → Authorized domains`에 다음 도메인을 추가한다.

```text
smgal-com-blog.web.app
```

로컬 확인에는 `localhost`를 사용한다. `127.0.0.1`은 별도 허용 도메인으로 취급될 수 있다.

## 4. 블로그 Hosting 사이트 생성 및 target 연결

먼저 실제 Hosting 사이트 목록을 확인한다.

```sh
npx firebase-tools hosting:sites:list \
  --project smgal-com-guestbook
```

목록에 `smgal-com-blog`가 있으면 사이트 생성 명령은 건너뛴다.

목록에 없다면 처음 한 번만 생성한다.

```sh
npx firebase-tools hosting:sites:create smgal-com-blog \
  --project smgal-com-guestbook
```

Hosting 사이트 ID는 Firebase 전체에서 고유해야 한다. `smgal-com-blog`를 사용할 수 없다면 다른 ID로 생성하고 다음 두 곳도 같은 ID로 변경한다.

1. 아래 `target:apply` 명령의 마지막 인자
2. 루트 `index.html`의 개인 블로그 URL

사이트를 `blog` target에 연결한다. 이 작업도 PC별로 처음 한 번만 하면 된다.

```sh
npx firebase-tools target:apply hosting blog smgal-com-blog \
  --project smgal-com-guestbook
```

명령이 성공하면 `.firebaserc`에 다음과 같은 연결이 생긴다.

```json
{
  "targets": {
    "smgal-com-guestbook": {
      "hosting": {
        "blog": [
          "smgal-com-blog"
        ]
      }
    }
  }
}
```

## 5. Firestore 보안 규칙 배포

루트 `firebase.json`은 블로그 프로젝트의 규칙 파일로 `blog/firestore.rules`를 지정한다.

```json
{
  "firestore": {
    "rules": "blog/firestore.rules"
  }
}
```

규칙을 배포한다.

```sh
npx firebase-tools deploy --only firestore \
  --project smgal-com-guestbook
```

> 주의: Firestore 규칙은 프로젝트의 기본 데이터베이스당 하나이다. 이 명령은 Firebase Console에 배포되어 있던 기존 규칙을 `blog/firestore.rules`로 교체한다. 현재 파일에는 블로그의 `blog_posts`, `blog_comments`, `categories`, `counters/blog_posts` 규칙과 기존 방명록의 `posts`, `counters/main_posts` 규칙이 함께 있어야 한다.

규칙 배포 후 변경 사항이 기존 연결에 완전히 반영되기까지 잠시 걸릴 수 있다.

## 6. 블로그 Hosting 배포

블로그만 배포한다.

```sh
npx firebase-tools deploy --only hosting:blog \
  --project smgal-com-guestbook
```

Firestore 규칙과 블로그를 한 번에 배포하려면 다음 명령을 사용한다.

```sh
npx firebase-tools deploy --only firestore,hosting:blog \
  --project smgal-com-guestbook
```

배포 결과에 다음 주소가 표시되는지 확인한다.

```text
https://smgal-com-blog.web.app
```

## 7. 선택 사항: 미리보기 채널

실서비스에 바로 반영하기 전에 임시 URL에서 확인하려면 다음 명령을 사용한다.

```sh
npx firebase-tools hosting:channel:deploy blog-preview \
  --only blog \
  --project smgal-com-guestbook
```

명령이 출력한 미리보기 URL에서 목록, 댓글, 관리자 로그인을 확인한 다음 정식 배포한다.

## 8. 메인 사이트 메뉴 배포

루트 `index.html`의 `개인 블로그` 메뉴는 `smgal-com-visits` Hosting 프로젝트에 따로 배포해야 실제 `smgal.com`에 반영된다.

먼저 target 연결을 확인한다.

```sh
npx firebase-tools hosting:sites:list \
  --project smgal-com-visits
```

`.firebaserc`에서 `visits` target이 `smgal-com-visits` 사이트에 연결되어 있어야 한다. 연결이 없으면 처음 한 번 실행한다.

```sh
npx firebase-tools target:apply hosting visits smgal-com-visits \
  --project smgal-com-visits
```

그다음 메인 Hosting을 배포한다.

```sh
npx firebase-tools deploy --only hosting:visits \
  --project smgal-com-visits
```

> `visits` Hosting의 `public`은 저장소 루트(`.`)이므로 많은 파일이 함께 배포된다. 실행 전 `firebase.json`의 `hosting` 설정과 작업 트리의 파일을 확인한다. `firebase.visits.json`은 방문 기록용 Firestore 규칙 설정이며 메인 Hosting 배포 설정이 아니다.

## 9. 배포 후 확인

다음 순서로 실제 동작을 확인한다.

1. `https://smgal-com-blog.web.app`가 `404`가 아닌 블로그 목록을 표시하는지 확인한다.
2. 관리자 페이지 `https://smgal-com-blog.web.app/admin.html`에서 본인 Google 계정으로 로그인한다.
3. 관리자 글 작성, 수정, 고정, 삭제를 확인한다.
4. 로그아웃 상태에서 익명 댓글을 작성하고 목록에서 바로 표시되는지 확인한다.
5. 비밀번호가 있는 익명 댓글의 삭제를 확인한다.
6. 운영자로 로그인한 상태에서 댓글을 작성해 `운영자` 표시가 붙는지 확인한다.
7. 글별 댓글 접기와 상단의 전체 댓글 접기 스위치를 확인한다.
8. 카테고리 필터와 페이지 이동을 확인한다.
9. `smgal.com` 메뉴의 `개인 블로그` 링크를 확인한다.

간단한 HTTP 확인:

```sh
curl -I https://smgal-com-blog.web.app
```

정상 배포 후 첫 응답 상태는 보통 `200`이어야 한다.

## 10. 반복 배포용 요약

최초의 사이트 생성과 target 연결이 끝난 PC에서는 보통 다음 두 명령만 사용한다.

블로그 코드와 Firestore 규칙:

```sh
npx firebase-tools deploy --only firestore,hosting:blog \
  --project smgal-com-guestbook
```

메인 페이지 메뉴:

```sh
npx firebase-tools deploy --only hosting:visits \
  --project smgal-com-visits
```

## 문제 해결

### `Site Not Found` 또는 `404`

- `hosting:sites:list`에서 실제 사이트가 생성되었는지 확인한다.
- `.firebaserc`의 target 이름만 보고 사이트가 생성됐다고 판단하지 않는다.
- `target:apply`의 사이트 ID와 루트 `index.html`의 URL이 같은지 확인한다.
- `hosting:blog` 배포가 성공했는지 Firebase Console의 Hosting 릴리스 기록에서 확인한다.

### Google 로그인 창이 닫히거나 로그인에 실패함

- 브라우저 개발자 도구 Console의 Firebase Auth 오류 코드를 확인한다.
- Google 로그인 제공업체가 활성화되어 있는지 확인한다.
- 현재 도메인이 Authorized domains에 있는지 확인한다.
- 로그인한 사용자의 UID가 `ADMIN_UID`와 같은지 확인한다.
- UID가 다르면 관리자 화면에 표시되는 차단된 계정 UID를 확인한 뒤 설정을 수정한다.

### `Missing or insufficient permissions`

- `blog/firestore.rules`가 실제로 배포되었는지 확인한다.
- 규칙의 관리자 UID와 로그인 계정 UID가 같은지 확인한다.
- 댓글 작성 대상 글의 `is_deleted`, `content_deleted` 값이 `false`인지 확인한다.

### 방명록이 배포 후 동작하지 않음

- `blog/firestore.rules`에 기존 `posts`와 `counters/main_posts` 규칙이 포함되어 있는지 확인한다.
- Firebase Console에서 규칙만 직접 수정했다면 로컬 파일과 다시 동기화한다. 이후 CLI 배포는 Console의 규칙을 덮어쓴다.

## 공식 문서

- [Firebase Hosting 멀티사이트와 deploy target](https://firebase.google.com/docs/hosting/multisites)
- [Firebase CLI 명령과 부분 배포](https://firebase.google.com/docs/cli)
- [Cloud Firestore 보안 규칙 배포](https://firebase.google.com/docs/firestore/security/get-started)
- [웹 Google 로그인 설정](https://firebase.google.com/docs/auth/web/google-signin)
