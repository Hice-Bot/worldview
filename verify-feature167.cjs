const http = require('http');

function fetch(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

(async () => {
  let allPassed = true;
  const results = [];

  function check(name, passed, detail) {
    results.push({ name, passed });
    if (!passed) allPassed = false;
    process.stdout.write((passed ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ': ' + detail : '') + '\n');
  }

  try {
    // Fetch the main page
    const html = await fetch('http://localhost:5173');
    check('Vite dev server responds', html.includes('<!DOCTYPE html'));

    // Fetch the CSS from dev server
    const css = await fetch('http://localhost:5173/src/index.css');

    // Check animation keyframes
    check('CSS has @keyframes modal-slide-in', css.includes('modal-slide-in'));
    check('CSS has @keyframes modal-slide-out', css.includes('modal-slide-out'));
    check('CSS has @keyframes backdrop-fade-in', css.includes('backdrop-fade-in'));
    check('CSS has @keyframes backdrop-fade-out', css.includes('backdrop-fade-out'));
    check('CSS has .modal-enter class', css.includes('.modal-enter'));
    check('CSS has .modal-exit class', css.includes('.modal-exit'));
    check('CSS has .backdrop-enter class', css.includes('.backdrop-enter'));
    check('CSS has .backdrop-exit class', css.includes('.backdrop-exit'));

    // Check animation properties
    check('modal-enter uses cubic-bezier easing', css.includes('cubic-bezier(0.32'));
    check('modal-enter has 0.3s duration', css.includes('0.3s'));
    check('modal-exit has 0.25s duration', css.includes('0.25s'));
    check('Animations use forwards fill-mode', css.includes('forwards'));

    // Check focus-visible styles (added by linter)
    check('CSS has focus-visible indicators', css.includes('focus-visible'));

    // Read source files directly
    const fs = require('fs');
    const jsContent = fs.readFileSync('src/components/ui/OperationsPanel.tsx', 'utf8');

    // OperationsPanel checks
    check('OperationsPanel has isClosing state', jsContent.includes('isClosing'));
    check('OperationsPanel has handleClose callback', jsContent.includes('handleClose'));
    check('OperationsPanel has handleOpen callback', jsContent.includes('handleOpen'));
    check('OperationsPanel modal uses modal-enter class', jsContent.includes('modal-enter'));
    check('OperationsPanel modal uses modal-exit class', jsContent.includes('modal-exit'));
    check('OperationsPanel modal uses backdrop-enter class', jsContent.includes('backdrop-enter'));
    check('OperationsPanel modal uses backdrop-exit class', jsContent.includes('backdrop-exit'));
    check('OperationsPanel FAB has active:scale-90', jsContent.includes('active:scale-90'));
    check('OperationsPanel FAB has onTouchEnd handler', jsContent.includes('onTouchEnd'));
    check('OperationsPanel modal has role=dialog', jsContent.includes('role=\\"dialog\\"') || jsContent.includes("role=\"dialog\""));
    check('OperationsPanel modal has aria-modal', jsContent.includes('aria-modal'));
    check('OperationsPanel close button has onTouchEnd', jsContent.split('onTouchEnd').length >= 2);
    check('OperationsPanel uses setTimeout 250ms for exit', jsContent.includes('250'));
    check('OperationsPanel uses useFocusTrap hook', jsContent.includes('useFocusTrap'));

    // IntelFeed checks
    const intelContent = fs.readFileSync('src/components/ui/IntelFeed.tsx', 'utf8');
    check('IntelFeed has isClosing state', intelContent.includes('isClosing'));
    check('IntelFeed has handleMobileClose', intelContent.includes('handleMobileClose'));
    check('IntelFeed modal uses modal-enter class', intelContent.includes('modal-enter'));
    check('IntelFeed modal uses modal-exit class', intelContent.includes('modal-exit'));
    check('IntelFeed badge has onTouchEnd handler', intelContent.includes('onTouchEnd'));
    check('IntelFeed modal has role=dialog', intelContent.includes('role=\\"dialog\\"') || intelContent.includes("role=\"dialog\""));
    check('IntelFeed uses useFocusTrap hook', intelContent.includes('useFocusTrap'));

    // CCTVPanel checks
    const cctvContent = fs.readFileSync('src/components/ui/CCTVPanel.tsx', 'utf8');
    check('CCTVPanel has isMobileClosing state', cctvContent.includes('isMobileClosing'));
    check('CCTVPanel has handleMobileClose', cctvContent.includes('handleMobileClose'));
    check('CCTVPanel modal uses modal-enter class', cctvContent.includes('modal-enter'));
    check('CCTVPanel modal uses modal-exit class', cctvContent.includes('modal-exit'));
    check('CCTVPanel badge has onTouchEnd handler', cctvContent.includes('onTouchEnd'));
    check('CCTVPanel modal has role=dialog', cctvContent.includes('role=\\"dialog\\"') || cctvContent.includes("role=\"dialog\""));
    check('CCTVPanel uses useFocusTrap hook', cctvContent.includes('useFocusTrap'));

    // Summary
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    process.stdout.write('\n========================================\n');
    process.stdout.write('RESULTS: ' + passed + '/' + total + ' checks passed\n');
    process.stdout.write('OVERALL: ' + (allPassed ? 'ALL PASSED' : 'SOME FAILED') + '\n');
    process.stdout.write('========================================\n');

    process.exit(allPassed ? 0 : 1);
  } catch (err) {
    process.stdout.write('Test error: ' + err.message + '\n');
    process.exit(1);
  }
})();
