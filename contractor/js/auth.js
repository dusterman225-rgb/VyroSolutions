    return map[err && err.code] || 'Something went wrong. Please try again.';
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  // Creates a login and a business. If the email already has a Vyqil login (for example a customer or an employee who now
  // owns a business), the same password signs in and the new business is added to that one login.
  async function signUp(email, password, businessName, product) {
    busy = true;
    try {
      var cred, existing = false, bizRefId = '';
      try { cred = await auth.createUserWithEmailAndPassword(email, password); }
      catch (e0) {
        if (e0 && e0.code === 'auth/email-already-in-use') {
          try { cred = await auth.signInWithEmailAndPassword(email, password); existing = true; }
          catch (e1) { throw { code: 'vyro/email-in-use' }; }
        } else { throw e0; }
      }
      try {
        var uid = cred.user.uid;
        var bizRef = db.collection('businesses').doc(); bizRefId = bizRef.id;
        var batch = db.batch();
        batch.set(bizRef, { name: businessName, ownerUid: uid, product: product || 'contractor', createdAt: stamp() });
        batch.set(bizRef.collection('members').doc(uid), { role: 'owner', email: email.toLowerCase(), createdAt: stamp() });
        var ud = { email: email.toLowerCase(), bizId: bizRef.id, bizIds: firebase.firestore.FieldValue.arrayUnion(bizRef.id) };
        if (!existing) ud.createdAt = stamp();
