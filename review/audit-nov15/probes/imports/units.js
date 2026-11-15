// Exploration: pure name/roster/gradebook functions on hand-built edge cases, in one page.
const H = require('./h.js');
(async () => {
  const { b, p } = await H.open();
  const out = await p.evaluate(() => { const A = window.__all; const R = t => A.parseRosterText(t).map(r => r.display + (r.alias ? ' =' + r.alias : '') + (r.id ? ' #' + r.id : ''));
    const res = {};
    res.headers = R('Student\tStudent ID\tGrade\nStudent Name\tID\nLast, First\nName (Last, First)\nPeriod 3\nMath 7 Accelerated\nTotal: 28 students\n1205050-7T1A\nSmith, John\n');
    res.aliases = R('Smith, John = JOHNNY SMITH\nMartin, Elodie = Élodie Martin\nDoe, Jane=JANE DOE\nLee, Al = AL LEE #2\n\n\t\nDoe, Jane\n');
    res.focusCopy = R('1. SMITH, JOHN A\n2\tDOE, JANE\n1000234\tDE LA CRUZ, OLIVIA M\t7\nO\'BRIEN, SEÁN\nNguyen Van, Anh   12345678\n"Smith-Jones, Mary Ann"\nSMITH JR., JOHN\nGarcía Márquez, José\nJohn Smith\nCher\n');
    res.crOnly = A.parseRosterText('Smith, John\rDoe, Jane\r').length;
    // name matching: a roster against IXL names
    const mk = (roster, ixl) => A.buildRows({ roster, students: ixl, ignored: {}, aliases: {} }).map(r => r.display + '→' + (r.ixlName || '-') + ':' + r.status + (r.tier ? '/' + r.tier : ''));
    res.match1 = mk('García, José\nO\'Brien, Sean\nSmith Jr., John\nDe La Cruz, Olivia\nVan Der Berg, Anna\nNguyen, Anh Thi\nLee, Al\nLee, Alexander', ['JOSE GARCIA', 'SEAN OBRIEN', 'JOHN SMITH', 'OLIVIA DELACRUZ', 'ANNA VANDERBERG', 'ANH NGUYEN', 'ALEXANDER LEE', 'AL LEE']);
    res.match2 = mk('Lee, Alexander\nLee, Al', ['AL LEE', 'ALEXANDER LEE']);
    res.match3 = mk('Lee, Al\nLee, Alexander', ['ALEXANDER LEE']);
    res.match4 = mk('Smith, John Michael\nSmith, John', ['JOHN SMITH', 'JOHN MICHAEL SMITH']);
    res.match5 = mk('Kim, Alex (ID …1234)\nKim, Alex (ID …5678)', ['ALEX KIM']);
    res.match6 = mk('Ng, Ann\nNg, Anna', ['ANNA NG']);
    res.match7 = mk('Søren, Kai\nZoë, Li', ['KAI SOREN', 'LI ZOE']);
    res.uniq = A.uniqueNames(['Kim, Alex', 'Kim, Alex', 'Lee, Al', 'Kim, Alex'], ['1001234', '2001234', '3', '']);
    res.uniq2 = A.uniqueNames(['Kim, Alex', 'Kim, Alex'], ['', '']);
    res.disp = ['MARIA DE LA CRUZ', 'JOHN SMITH JR', 'ANNA VAN DER BERG', 'JOSE MARIA GARCIA LOPEZ', 'LE', 'AL ST JOHN'].map(A.ixlDisplay);
    res.mask = ['Smith, John', 'Cher', ' , x'].map(A.mask);
    return res; });
  for (const k in out) console.log(k, JSON.stringify(out[k]));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });
