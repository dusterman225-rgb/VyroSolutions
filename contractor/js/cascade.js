// Shared helpers: delete jobs/customers properly, and archive/restore customers.
(function () {
  var ACTIVE = ['Not Started', 'In Progress', 'On Hold'];

  // Portals live in js/portal.js; load it on demand so any page can clean up.
  function withPortal() {
    if (window.vportal) return Promise.resolve(true);
    return new Promise(function (res) {
      var s = document.createElement('script'); s.src = 'js/portal.js';
      s.onload = function () { res(!!window.vportal); }; s.onerror = function () { res(false); };
      document.head.appendChild(s);
    });
  }
  async function dropPortalForJob(jobId) {
    try { if (await withPortal()) await vportal.removeForJob(jobId); } catch (e) { /* portal cleanup is best-effort */ }
  }
  async function dropPortalsForCustomer(bizRef, customerId) {
    try { if (await withPortal()) await vportal.removeForCustomer({ bizRef: bizRef }, customerId); } catch (e) { /* best-effort */ }
  }

  // Deletes a job and its update log. Marks the estimate "dismissed" so the Jobs page does not re-create it.
  async function deleteJob(bizRef, jobId) {
    var jref = bizRef.collection('jobs').doc(jobId);
    await dropPortalForJob(jobId);
    var us = await jref.collection('updates').get();
    var docs = us.docs.slice();
    while (docs.length) {
      var batch = vyro.db.batch();
      docs.splice(0, 400).forEach(function (d) { batch.delete(d.ref); });
      await batch.commit();
    }
    await jref.delete();
    try { await bizRef.collection('estimates').doc(jobId).update({ jobDismissed: true }); } catch (e) { /* estimate may not exist */ }
  }

  async function jobsOfCustomer(bizRef, customerId) {
    var s = await bizRef.collection('jobs').where('customerId', '==', customerId).get();
    return s.docs.map(function (d) { var x = d.data(); x.id = d.id; return x; });
  }

  // Deletes the customer and every job that belongs to them. Estimates and invoices are kept for the records.
  async function deleteCustomer(bizRef, customerId) {
    var jobs = await jobsOfCustomer(bizRef, customerId);
    for (var i = 0; i < jobs.length; i++) await deleteJob(bizRef, jobs[i].id);
    await bizRef.collection('customers').doc(customerId).delete();
    return jobs.length;
  }

  async function setArchived(bizRef, customerId, flag) {
    if (flag) await dropPortalsForCustomer(bizRef, customerId);
    await bizRef.collection('customers').doc(customerId).update({
      archived: !!flag, archivedAt: flag ? vyro.stamp() : null, updatedAt: vyro.stamp()
    });
  }

  // Called after a job's status changes: finished work archives the customer, restarted work restores them.
  async function afterJobStatus(bizRef, customerId, newStatus, thisJobId) {
    if (!customerId) return;
    if (newStatus === 'Completed') {
      var jobs = await jobsOfCustomer(bizRef, customerId);
      var otherActive = jobs.some(function (j) { return j.id !== thisJobId && ACTIVE.indexOf(j.status) > -1; });
      if (!otherActive) await setArchived(bizRef, customerId, true);
    } else if (ACTIVE.indexOf(newStatus) > -1) {
      await setArchived(bizRef, customerId, false);
    }
  }

  window.vcascade = { dropPortalsForCustomer: dropPortalsForCustomer, ACTIVE: ACTIVE, deleteJob: deleteJob, deleteCustomer: deleteCustomer,
                      jobsOfCustomer: jobsOfCustomer, setArchived: setArchived, afterJobStatus: afterJobStatus };
})();
