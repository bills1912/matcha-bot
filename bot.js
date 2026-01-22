import puppeteer from 'puppeteer';
import config from './config.js';

export class MatchaBot {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isRunning = false;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async initialize() {
    try {
      console.log('🔌 Connecting to existing Chrome instance...');
      this.browser = await puppeteer.connect({
        browserURL: 'http://localhost:9222',
        defaultViewport: null
      });

      const pages = await this.browser.pages();
      if (pages.length > 0) {
        this.page = pages[0];
        console.log('✅ Connected to existing tab');
      } else {
        this.page = await this.browser.newPage();
        console.log('✅ Created new tab');
      }
      
      await this.page.setExtraHTTPHeaders(config.headers);
      
      console.log('✅ Browser connected successfully');
    } catch (error) {
      console.error('❌ Failed to connect to browser');
      console.error('Make sure Chrome is running with: --remote-debugging-port=9222');
      throw error;
    }
  }

  async waitForManualLogin() {
    try {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔐 CHECKING LOGIN STATUS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      // Cek URL saat ini
      const currentUrl = this.page.url();
      console.log('📍 Current URL:', currentUrl);
      
      // Cek apakah sudah di Matcha Pro
      if (!currentUrl.includes('matchapro.web.bps.go.id')) {
        console.log('⚠️ Not on Matcha Pro site yet');
        console.log('🔗 Navigating to Matcha Pro...');
        await this.page.goto(`${config.matchaProUrl}`, { 
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        await this.delay(2000);
      }

      console.log('⏳ Checking if you are logged in...');
      
      // Cek apakah sudah login
      let isLoggedIn = false;
      let attempts = 0;
      const maxAttempts = 600; // 10 menit
      
      while (!isLoggedIn && attempts < maxAttempts) {
        await this.delay(1000);
        attempts++;
        
        try {
          const currentUrl = this.page.url();
          
          // Debug: Log URL setiap 5 detik
          if (attempts % 5 === 0) {
            console.log(`🔍 Current URL: ${currentUrl}`);
          }
          
          // Cek berbagai indikator login
          const loginStatus = await this.page.evaluate(() => {
            // Cek 1: URL tidak mengandung login/signin
            const url = window.location.href;
            const notOnLoginPage = !url.includes('/login') && !url.includes('/signin');
            
            // Cek 2: Ada elemen yang hanya muncul setelah login
            const hasUserElement = document.querySelector('[class*="user"], [class*="profile"], [href*="logout"], [class*="avatar"]') !== null;
            
            // Cek 3: Ada menu/navigation yang hanya muncul setelah login
            const hasNavigation = document.querySelector('nav, [class*="menu"], [class*="sidebar"]') !== null;
            
            // Cek 4: Tidak ada form login
            const noLoginForm = document.querySelector('input[type="password"]') === null;
            
            return {
              notOnLoginPage,
              hasUserElement,
              hasNavigation,
              noLoginForm,
              url: window.location.href
            };
          });
          
          // Debug log
          if (attempts % 10 === 0) {
            console.log('📊 Login check:', JSON.stringify(loginStatus, null, 2));
          }
          
          // Anggap sudah login jika memenuhi minimal 2 kriteria
          const criteriasMet = [
            loginStatus.notOnLoginPage,
            loginStatus.hasUserElement,
            loginStatus.hasNavigation,
            loginStatus.noLoginForm
          ].filter(Boolean).length;
          
          isLoggedIn = criteriasMet >= 2;
          
        } catch (error) {
          console.error('Error checking login status:', error.message);
        }
        
        // Log progress
        if (attempts % 10 === 0) {
          const minutes = Math.floor(attempts / 60);
          const seconds = attempts % 60;
          console.log(`⏳ Waiting for login... (${minutes}m ${seconds}s elapsed)`);
          
          if (!isLoggedIn) {
            console.log('💡 Please login in the Chrome window if you haven\'t');
          }
        }
      }
      
      if (isLoggedIn) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ LOGIN DETECTED!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Screenshot untuk konfirmasi
        await this.page.screenshot({ path: 'logged-in.png' });
        console.log('📸 Screenshot saved: logged-in.png');
        
        return true;
      } else {
        console.log('❌ Login timeout (10 minutes)');
        return false;
      }
    } catch (error) {
      console.error('❌ Error waiting for login:', error.message);
      return false;
    }
  }

  async login() {
    return await this.waitForManualLogin();
  }

  async processRow(rowData) {
    try {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 Row Data:', JSON.stringify(rowData, null, 2));
      
      const { idsbr, keberadaan_usaha, latitude, longitude, cek } = rowData;

      // Skip jika sudah dicek
      if (cek === true || cek === 'TRUE' || cek === 1 || cek === '1') {
        console.log('⏭️ SKIP: Already checked (cek =', cek, ')');
        return { status: 'skipped', reason: 'Already checked' };
      }

      // Skip jika latitude/longitude kosong atau strip
      if (!latitude || !longitude || latitude === '-' || longitude === '-' || latitude === '' || longitude === '') {
        console.log('⏭️ SKIP: Empty coordinates (lat:', latitude, ', lon:', longitude, ')');
        return { status: 'skipped', reason: 'Empty coordinates' };
      }

      console.log('✅ Processing:', { idsbr, keberadaan_usaha, latitude, longitude });

      // Navigasi ke halaman Ground Check
      console.log('🔗 Navigating to /dirgc...');
      await this.page.goto(`${config.matchaProUrl}/dirgc`, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      await this.delay(3000);
      
      // Screenshot
      await this.page.screenshot({ path: `debug-step1-dirgc.png` });
      console.log('📸 Screenshot: debug-step1-dirgc.png');

      // Klik menu Ground Check Direktori Usaha
      console.log('🖱️ Looking for Ground Check menu...');
      const groundCheckClicked = await this.page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        const gcElement = elements.find(el => {
          const text = el.textContent || '';
          return text.includes('Ground Check') && text.includes('Direktori');
        });
        
        if (gcElement) {
          console.log('Found Ground Check element:', gcElement.tagName, gcElement.className);
          gcElement.click();
          return true;
        }
        return false;
      });

      if (!groundCheckClicked) {
        console.log('❌ Ground Check menu not found');
        await this.page.screenshot({ path: `debug-failed-no-gc-menu.png` });
        return { status: 'failed', reason: 'Ground Check menu not found' };
      }

      console.log('✅ Ground Check clicked');
      await this.delay(3000);

      // Screenshot
      await this.page.screenshot({ path: `debug-step2-after-gc-click.png` });
      console.log('📸 Screenshot: debug-step2-after-gc-click.png');

      // Buka filter/pencarian
      console.log('🔍 Opening filter...');
      const filterClicked = await this.page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        const filterElement = elements.find(el => {
          const text = el.textContent || '';
          return text.includes('Pencarian') || text.includes('Filter');
        });
        
        if (filterElement) {
          console.log('Found Filter element');
          filterElement.click();
          return true;
        }
        return false;
      });

      if (filterClicked) {
        console.log('✅ Filter opened');
      }
      
      await this.delay(2000);

      // Input IDSBR
      console.log('⌨️ Typing IDSBR:', idsbr);
      const inputSuccess = await this.page.evaluate((id) => {
        // Cari input field untuk IDSBR
        const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"]'));
        
        // Coba cari berdasarkan placeholder atau name
        let targetInput = inputs.find(inp => 
          inp.placeholder?.includes('15439505') || 
          inp.placeholder?.includes('IDSBR') ||
          inp.name?.toLowerCase().includes('idsbr')
        );
        
        // Jika tidak ada, pakai input pertama yang visible
        if (!targetInput) {
          targetInput = inputs.find(inp => inp.offsetParent !== null);
        }
        
        if (targetInput) {
          targetInput.focus();
          targetInput.value = '';
          targetInput.value = String(id);
          targetInput.dispatchEvent(new Event('input', { bubbles: true }));
          targetInput.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('Input success, value:', targetInput.value);
          return true;
        }
        
        console.log('Input not found');
        return false;
      }, idsbr);

      if (!inputSuccess) {
        console.log('❌ Could not input IDSBR');
        await this.page.screenshot({ path: `debug-failed-no-input.png` });
        return { status: 'failed', reason: 'IDSBR input not found' };
      }

      console.log('✅ IDSBR typed');
      await this.delay(2000);

      // Tutup filter
      if (filterClicked) {
        console.log('🔍 Closing filter...');
        await this.page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('*'));
          const filterElement = elements.find(el => {
            const text = el.textContent || '';
            return text.includes('Pencarian') || text.includes('Filter');
          });
          if (filterElement) {
            filterElement.click();
          }
        });
        await this.delay(2000);
      }

      // Screenshot hasil filter
      await this.page.screenshot({ path: `debug-step3-after-search.png` });
      console.log('📸 Screenshot: debug-step3-after-search.png');

      // PERBAIKAN: Cari dan klik hasil pertama dengan berbagai metode
      console.log('🖱️ Looking for search result...');
      
      // Metode 1: Cari berdasarkan IDSBR yang dicari
      let resultClicked = await this.page.evaluate((searchId) => {
        const allElements = Array.from(document.querySelectorAll('*'));
        
        // Cari element yang mengandung IDSBR yang dicari
        const resultElement = allElements.find(el => {
          const text = el.textContent || '';
          return text.includes(String(searchId)) && 
                 el.tagName !== 'INPUT' && 
                 el.tagName !== 'SCRIPT';
        });
        
        if (resultElement) {
          console.log('Found by IDSBR:', resultElement.tagName, resultElement.className);
          // Cari parent yang clickable (card/item)
          let clickable = resultElement;
          while (clickable && clickable !== document.body) {
            if (clickable.onclick || 
                clickable.style.cursor === 'pointer' ||
                clickable.tagName === 'A' ||
                clickable.tagName === 'BUTTON' ||
                clickable.className.includes('card') ||
                clickable.className.includes('item')) {
              clickable.click();
              return true;
            }
            clickable = clickable.parentElement;
          }
          // Jika tidak ada parent clickable, click element itu sendiri
          resultElement.click();
          return true;
        }
        
        return false;
      }, idsbr);

      // Metode 2: Jika metode 1 gagal, cari berdasarkan class/struktur
      if (!resultClicked) {
        console.log('⚠️ Method 1 failed, trying method 2...');
        
        resultClicked = await this.page.evaluate(() => {
          // Cari semua element yang mungkin hasil pencarian
          const selectors = [
            '[class*="card"]:not([class*="filter"])',
            '[class*="item"]:not([class*="filter"])',
            '[class*="list-"]:not([class*="filter"])',
            '[class*="result"]',
            '[class*="usaha"]',
            '[class*="kelontong"]',
            'div[class*="border"]',
            'div[onclick]'
          ];
          
          for (const selector of selectors) {
            const items = document.querySelectorAll(selector);
            console.log(`Trying selector: ${selector}, found: ${items.length}`);
            
            for (const item of items) {
              // Cek apakah element visible dan ada konten
              const rect = item.getBoundingClientRect();
              const isVisible = rect.width > 0 && rect.height > 0 && 
                               item.offsetParent !== null;
              const hasContent = item.textContent.trim().length > 20;
              
              if (isVisible && hasContent) {
                console.log('Found result with selector:', selector);
                console.log('Content preview:', item.textContent.substring(0, 50));
                item.click();
                return true;
              }
            }
          }
          
          return false;
        });
      }

      // Metode 3: Jika masih gagal, cari semua div yang ada text panjang
      if (!resultClicked) {
        console.log('⚠️ Method 2 failed, trying method 3...');
        
        resultClicked = await this.page.evaluate(() => {
          const allDivs = document.querySelectorAll('div, li, tr');
          const candidates = [];
          
          for (const div of allDivs) {
            const rect = div.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;
            const text = div.textContent.trim();
            const hasContent = text.length > 30 && text.length < 500;
            
            // Exclude filter/header areas
            const isNotFilter = !div.className.includes('filter') && 
                               !div.className.includes('header') &&
                               !div.className.includes('navbar');
            
            if (isVisible && hasContent && isNotFilter) {
              candidates.push({
                element: div,
                y: rect.y,
                textLength: text.length
              });
            }
          }
          
          // Sort by position (paling atas) dan text length
          candidates.sort((a, b) => {
            if (Math.abs(a.y - b.y) < 50) { // Jika Y position mirip
              return b.textLength - a.textLength; // Pilih yang lebih panjang
            }
            return a.y - b.y; // Pilih yang paling atas
          });
          
          if (candidates.length > 0) {
            console.log('Found candidate results:', candidates.length);
            console.log('Clicking first candidate at Y:', candidates[0].y);
            candidates[0].element.click();
            return true;
          }
          
          return false;
        });
      }

      // Metode 4: Last resort - click di area hasil (koordinat)
      if (!resultClicked) {
        console.log('⚠️ Method 3 failed, trying method 4 (coordinate click)...');
        
        try {
          // Get viewport size
          const viewport = await this.page.evaluate(() => ({
            width: window.innerWidth,
            height: window.innerHeight
          }));
          
          // Click di tengah-kanan layar (biasanya area hasil di sana)
          const x = viewport.width * 0.6;
          const y = viewport.height * 0.4;
          
          console.log(`Clicking at coordinates: ${x}, ${y}`);
          await this.page.mouse.click(x, y);
          resultClicked = true;
          
        } catch (e) {
          console.log('Coordinate click failed:', e.message);
        }
      }

      if (!resultClicked) {
        console.log('❌ All methods failed - Search result not found');
        await this.page.screenshot({ path: `debug-failed-no-result-${idsbr}.png` });
        
        // Debug: tampilkan struktur halaman
        const pageStructure = await this.page.evaluate(() => {
          const elements = document.querySelectorAll('div, li, article, section');
          return Array.from(elements).slice(0, 20).map(el => ({
            tag: el.tagName,
            class: el.className,
            text: el.textContent.substring(0, 50)
          }));
        });
        console.log('Page structure:', JSON.stringify(pageStructure, null, 2));
        
        return { status: 'failed', reason: 'Search result not found for IDSBR: ' + idsbr };
      }

      console.log('✅ Result clicked');
      await this.delay(3000);

      // Screenshot form
      await this.page.screenshot({ path: `debug-step4-form-opened-${idsbr}.png` });
      console.log('📸 Screenshot: debug-step4-form-opened.png');

      // Cek koordinat
      console.log('🔍 Checking coordinates in form...');
      const coordCheck = await this.page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const latInput = inputs.find(inp => 
          inp.name?.toLowerCase().includes('latitude') || 
          inp.placeholder?.toLowerCase().includes('latitude') ||
          inp.id?.toLowerCase().includes('latitude')
        );
        const lonInput = inputs.find(inp => 
          inp.name?.toLowerCase().includes('longitude') || 
          inp.placeholder?.toLowerCase().includes('longitude') ||
          inp.id?.toLowerCase().includes('longitude')
        );
        
        return {
          hasLatInput: !!latInput,
          hasLonInput: !!lonInput,
          latValue: latInput?.value || 'not found',
          lonValue: lonInput?.value || 'not found'
        };
      });

      console.log('📍 Coordinate check:', coordCheck);

      if (!coordCheck.hasLatInput || !coordCheck.hasLonInput) {
        console.log('❌ Coordinate inputs not found in form');
        return { status: 'skipped', reason: 'No coordinate inputs in form' };
      }

      if (coordCheck.latValue === '-' || coordCheck.lonValue === '-' || 
          !coordCheck.latValue || !coordCheck.lonValue ||
          coordCheck.latValue === 'not found' || coordCheck.lonValue === 'not found') {
        console.log('❌ Coordinates are empty in form');
        return { status: 'skipped', reason: 'Form coordinates are empty' };
      }

      console.log('✅ Coordinates found:', coordCheck.latValue, coordCheck.lonValue);

      // Pilih keberadaan usaha
      let keberadaanValue = '';
      if (keberadaan_usaha === 1 || keberadaan_usaha === 2 || keberadaan_usaha === '1' || keberadaan_usaha === '2') {
        keberadaanValue = 'Ditemukan';
      } else if (keberadaan_usaha === 4 || keberadaan_usaha === '4') {
        keberadaanValue = 'Tutup';
      } else if (keberadaan_usaha === 9 || keberadaan_usaha === '9') {
        keberadaanValue = 'Ganda';
      } else {
        console.log('❌ Invalid keberadaan_usaha code:', keberadaan_usaha);
        return { status: 'failed', reason: 'Invalid keberadaan_usaha code: ' + keberadaan_usaha };
      }

      console.log('🔽 Selecting keberadaan:', keberadaanValue);

      // Pilih dari dropdown
      const dropdownSelected = await this.page.evaluate((value) => {
        const selects = document.querySelectorAll('select');
        for (const select of selects) {
          const name = select.name?.toLowerCase() || '';
          const id = select.id?.toLowerCase() || '';
          
          if (name.includes('keberadaan') || id.includes('keberadaan')) {
            // Cari option berdasarkan text
            const options = Array.from(select.options);
            const targetOption = options.find(opt => opt.text.includes(value));
            
            if (targetOption) {
              select.value = targetOption.value;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              console.log('Dropdown selected:', value);
              return true;
            }
          }
        }
        return false;
      }, keberadaanValue);

      if (!dropdownSelected) {
        console.log('❌ Dropdown not found or could not select');
        await this.page.screenshot({ path: `debug-failed-dropdown.png` });
        return { status: 'failed', reason: 'Could not select keberadaan dropdown' };
      }

      console.log('✅ Dropdown selected');
      await this.delay(2000);

      // Screenshot sebelum submit
      await this.page.screenshot({ path: `debug-step5-before-submit.png` });
      console.log('📸 Screenshot: debug-step5-before-submit.png');

      // Klik tombol submit
      console.log('🖱️ Looking for submit button...');
      const submitClicked = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const submitButton = buttons.find(btn => {
          const text = btn.textContent || '';
          return text.includes('TANDAI') || 
                 text.includes('Tandai') ||
                 text.includes('DICEK') ||
                 text.includes('Simpan') ||
                 text.includes('Submit');
        });
        
        if (submitButton) {
          console.log('Found submit button:', submitButton.textContent);
          submitButton.click();
          return true;
        }
        return false;
      });

      if (!submitClicked) {
        console.log('❌ Submit button not found');
        await this.page.screenshot({ path: `debug-failed-no-submit.png` });
        return { status: 'failed', reason: 'Submit button not found' };
      }

      console.log('✅ Submit clicked');
      await this.delay(3000);

      // Screenshot after submit
      await this.page.screenshot({ path: `debug-step6-after-submit.png` });
      console.log('📸 Screenshot: debug-step6-after-submit.png');

      console.log('✅✅✅ SUCCESS!');
      return { status: 'success', message: `IDSBR ${idsbr} marked as ${keberadaanValue}` };

    } catch (error) {
      console.error('❌ Error processing row:', error.message);
      console.error('Stack:', error.stack);
      
      try {
        await this.page.screenshot({ path: `debug-error-${Date.now()}.png` });
        console.log('📸 Error screenshot saved');
      } catch (e) {
        // ignore
      }
      
      return { status: 'failed', reason: error.message };
    }
  }

  async close() {
    console.log('⚠️ Browser tetap terbuka (user controlled)');
  }
}