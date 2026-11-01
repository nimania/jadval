/* Public Firebase WEB settings only. No service-account keys belong here.
   The settings are intentionally blank until the owner connects a dedicated project.
   Firebase web apiKey is a public identifier, NOT an authorization control.
   All database access is enforced through Firebase Authentication and rules. */
window.JADVAL_FIREBASE_CONFIG = {
  apiKey: "AIzaSyD9-PPlqoSxfWNARZ-gLHqUaZTaG9D23B4",
  authDomain: "jadval-studio.firebaseapp.com",
  projectId: "jadval-studio",
  appId: "1:63351164855:web:f4be8565245e66944b6232"
};
if (["apiKey","authDomain","projectId","appId"].every(k=>window.JADVAL_FIREBASE_CONFIG[k])) {
  document.documentElement.classList.add("cloud-locked");
}
