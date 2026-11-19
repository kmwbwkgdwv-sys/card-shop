// ===== Firebase の設定 =====
// いまは「マートメイツ」と同じ Firebase プロジェクト（supermarket-9acfb）を使う設定です。
// このゲームのデータはデータベースの tcg/ の下に保存されるので、マートメイツのデータとは混ざりません。
// ※ README.md の「Firebase の設定」にある database.rules.json（マートメイツ用のルールも入っています）を公開してください。
// 別のプロジェクトを使うときは、下の値を自分のプロジェクトの firebaseConfig に書きかえてください。
// ウェブ用の apiKey は公開される前提の値です。データを守るのは「データベースのルール」と「匿名ログイン」です。
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCmGEsZf7oLeOT6FWEQ8YWJOaNmv6Z-Ewc',
  authDomain: 'supermarket-9acfb.firebaseapp.com',
  databaseURL: 'https://supermarket-9acfb-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'supermarket-9acfb',
};
