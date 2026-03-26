// ── SCHEMA STAGE — Deterministic JSON-LD Assembly ─────────────────────────
// Builds rich schema markup from data collected in stages 1-9.
// No AI calls needed — pure data assembly + validation.

var schemaStopFlag = false;
function stopSchema() { schemaStopFlag = true; }

// ── CMS Variables (for template pages) ─────────────────────────────────
var CMS_VARS = {
  webflow:   { title: '{{name}}', description: '{{summary}}', slug: '{{slug}}', image: '{{main-image.src}}', date: '{{published-on}}', author: '{{author-name}}' },
  wordpress: { title: '<?php the_title(); ?>', description: '<?php the_excerpt(); ?>', slug: '<?php echo get_post_field("post_name"); ?>', image: '<?php the_post_thumbnail_url(); ?>', date: '<?php the_date("c"); ?>', author: '<?php the_author(); ?>' },
  shopify:   { title: '{{ product.title }}', description: '{{ product.description }}', slug: '{{ product.handle }}', image: '{{ product.featured_image | img_url }}', date: '{{ product.created_at }}', author: '' },
  framer:    { title: '{title}', description: '{description}', slug: '{slug}', image: '{image}', date: '{date}', author: '{author}' },
  custom:    { title: '{{title}}', description: '{{description}}', slug: '{{slug}}', image: '{{image}}', date: '{{date}}', author: '{{author}}' }
};
var CMS_PAGE_TYPES = ['blog','article','portfolio','product','event','recipe'];

// ── Base URL helper ───────────────────────────────────────────────────
function _schemaBaseUrl() {
  var url = (S.setup && S.setup.url) || 'example.com';
  if (!/^https?:\/\//.test(url)) url = 'https://' + url;
  return url.replace(/\/+$/, '');
}

// ── Build Organization/LocalBusiness (shared across all pages) ────────
function _buildOrgSchema() {
  var r = S.research || {};
  var s = S.setup || {};
  var base = _schemaBaseUrl();
  var isLocal = r.schema_has_physical_locations || r.schema_street_address;
  var type = r.schema_business_type || (isLocal ? 'LocalBusiness' : 'Organization');

  var org = {
    '@type': type,
    '@id': base + '/#organization',
    'name': r.brand_name || s.client || '',
    'url': base,
    'description': r.business_description || r.value_proposition || ''
  };

  // Logo
  if (r.logo_url) org.logo = { '@type': 'ImageObject', '@id': base + '/#logo', 'url': r.logo_url };

  // Contact
  if (r.schema_phone) org.telephone = r.schema_phone;
  if (r.schema_email) org.email = r.schema_email;

  // Address
  if (r.schema_street_address || r.schema_city) {
    org.address = { '@type': 'PostalAddress' };
    if (r.schema_street_address) org.address.streetAddress = r.schema_street_address;
    if (r.schema_city) org.address.addressLocality = r.schema_city;
    if (r.schema_region) org.address.addressRegion = r.schema_region;
    if (r.schema_postal_code) org.address.postalCode = r.schema_postal_code;
    if (r.schema_country) org.address.addressCountry = r.schema_country;
  }

  // Social profiles
  var sameAs = (r.social_profiles || []).map(function(sp) { return sp.url; }).filter(Boolean);
  if (sameAs.length) org.sameAs = sameAs;

  // Founding
  if (r.founding_year) org.foundingDate = r.founding_year;

  // Price range
  if (r.schema_price_range) org.priceRange = r.schema_price_range;

  // Area served
  if (r.geography && r.geography.primary) {
    org.areaServed = { '@type': 'City', 'name': r.geography.primary };
  }

  // Category
  if (r.schema_primary_category) org.additionalType = r.schema_primary_category;

  // Aggregate rating
  if (r.reviews && r.reviews.length) {
    var totalRating = 0, ratedCount = 0;
    r.reviews.forEach(function(rv) {
      var val = parseFloat(rv.rating_value);
      if (val > 0) { totalRating += val; ratedCount++; }
    });
    if (ratedCount > 0) {
      org.aggregateRating = {
        '@type': 'AggregateRating',
        'ratingValue': Math.round(totalRating / ratedCount * 10) / 10,
        'reviewCount': r.reviews.length,
        'bestRating': 5
      };
    }
  }

  // Awards
  if (r.awards_certifications && r.awards_certifications.length) {
    org.award = r.awards_certifications;
  }

  // Payment
  if (r.schema_payment_methods && r.schema_payment_methods.length) {
    org.paymentAccepted = r.schema_payment_methods.join(', ');
  }

  return org;
}

// ── Build Breadcrumb for a page ───────────────────────────────────────
function _buildBreadcrumb(page) {
  var base = _schemaBaseUrl();
  var parts = (page.slug || '').split('/').filter(Boolean);
  var items = [{ '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': base + '/' }];
  var path = '';
  for (var i = 0; i < parts.length; i++) {
    path += '/' + parts[i];
    var isLast = i === parts.length - 1;
    var item = { '@type': 'ListItem', 'position': i + 2, 'name': isLast ? (page.page_name || parts[i]) : parts[i].replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); }) };
    if (!isLast) item.item = base + path;
    items.push(item);
  }
  return { '@type': 'BreadcrumbList', '@id': base + '/' + page.slug + '#breadcrumb', 'itemListElement': items };
}

// ── Build WebPage schema ──────────────────────────────────────────────
function _buildWebPage(page) {
  var base = _schemaBaseUrl();
  var wp = {
    '@type': 'WebPage',
    '@id': base + '/' + page.slug + '#webpage',
    'url': base + '/' + page.slug,
    'name': page.meta_title || page.page_name || '',
    'description': page.meta_description || '',
    'isPartOf': { '@id': base + '/#website' },
    'breadcrumb': { '@id': base + '/' + page.slug + '#breadcrumb' }
  };
  if (page.primary_keyword) wp.about = page.primary_keyword;
  return wp;
}

// ── Build WebSite schema (homepage only) ──────────────────────────────
function _buildWebSite() {
  var base = _schemaBaseUrl();
  var s = S.setup || {};
  return {
    '@type': 'WebSite',
    '@id': base + '/#website',
    'url': base + '/',
    'name': s.client || '',
    'publisher': { '@id': base + '/#organization' }
  };
}

// ── Build FAQPage from page copy FAQ section ──────────────────────────
function _extractFaqsFromCopy(slug) {
  var copyData = S.copy && S.copy[slug];
  var faqs = [];
  // Try assigned questions first
  var page = (S.pages || []).find(function(p) { return p.slug === slug; });
  if (page && page.assignedQuestions && page.assignedQuestions.length) {
    page.assignedQuestions.forEach(function(q) {
      if (q && q.trim()) faqs.push({ question: q.trim(), answer: '' });
    });
  }
  // If we have copy HTML, extract actual FAQ Q&A from it
  if (copyData && copyData.html) {
    var html = copyData.html;
    // Look for FAQ section — h3 followed by p
    var faqRe = /<h3[^>]*>([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
    var match;
    var copyFaqs = [];
    while ((match = faqRe.exec(html)) !== null) {
      var q = match[1].replace(/<[^>]+>/g, '').trim();
      var a = match[2].replace(/<[^>]+>/g, '').trim();
      if (q && a && (q.includes('?') || q.length < 120)) {
        copyFaqs.push({ question: q, answer: a.slice(0, 500) });
      }
    }
    if (copyFaqs.length >= 3) faqs = copyFaqs; // prefer copy FAQs if we got enough
  }
  // Fallback to research FAQs
  if (!faqs.length) {
    var r = S.research || {};
    (r.current_faqs || []).forEach(function(f) {
      if (f.question) faqs.push({ question: f.question, answer: f.answer || '' });
    });
  }
  return faqs;
}

function _buildFaqPage(faqs, pageSlug) {
  if (!faqs.length) return null;
  var base = _schemaBaseUrl();
  return {
    '@type': 'FAQPage',
    '@id': base + '/' + pageSlug + '#faq',
    'mainEntity': faqs.map(function(f) {
      return {
        '@type': 'Question',
        'name': f.question,
        'acceptedAnswer': { '@type': 'Answer', 'text': f.answer || f.question }
      };
    })
  };
}

// ── Build Service schema ──────────────────────────────────────────────
function _buildService(page) {
  var base = _schemaBaseUrl();
  var r = S.research || {};
  var svc = {
    '@type': 'Service',
    '@id': base + '/' + page.slug + '#service',
    'name': page.page_name || page.primary_keyword || '',
    'url': base + '/' + page.slug,
    'provider': { '@id': base + '/#organization' }
  };
  if (page.page_goal) svc.description = page.page_goal;
  if (r.geography && r.geography.primary) {
    svc.areaServed = { '@type': 'City', 'name': r.geography.primary };
  }
  // Service type from keyword
  if (page.primary_keyword) svc.serviceType = page.primary_keyword;
  return svc;
}

// ── Build Article/BlogPosting schema ──────────────────────────────────
function _buildArticle(page) {
  var base = _schemaBaseUrl();
  var r = S.research || {};
  var article = {
    '@type': 'BlogPosting',
    '@id': base + '/' + page.slug + '#article',
    'headline': page.meta_title || page.page_name || '',
    'url': base + '/' + page.slug,
    'mainEntityOfPage': { '@id': base + '/' + page.slug + '#webpage' },
    'author': { '@id': base + '/#organization' },
    'publisher': { '@id': base + '/#organization' },
    'datePublished': new Date().toISOString().split('T')[0]
  };
  if (page.meta_description) article.description = page.meta_description;
  if (page.primary_keyword) article.keywords = page.primary_keyword;
  if (page.contentPillar) article.articleSection = page.contentPillar;
  // Image from page images
  var imgData = S.images && S.images[page.slug];
  if (imgData && imgData.url) {
    article.image = { '@type': 'ImageObject', 'url': imgData.url };
  }
  return article;
}

// ── Build Product schema (ecommerce) ──────────────────────────────────
function _buildProduct(page) {
  var base = _schemaBaseUrl();
  var product = {
    '@type': 'Product',
    '@id': base + '/' + page.slug + '#product',
    'name': page.page_name || page.primary_keyword || '',
    'url': base + '/' + page.slug,
    'description': page.meta_description || page.page_goal || ''
  };
  // Try to find matching product from schema scrape
  var r = S.research || {};
  if (r._schema_products && r._schema_products.length) {
    var match = r._schema_products.find(function(p) {
      return p.name && (page.page_name || '').toLowerCase().indexOf(p.name.toLowerCase()) >= 0;
    });
    if (match) {
      if (match.brand) product.brand = { '@type': 'Brand', 'name': match.brand };
      if (match.sku) product.sku = match.sku;
      if (match.price) {
        product.offers = {
          '@type': 'Offer',
          'price': match.price,
          'priceCurrency': match.currency || 'CAD',
          'availability': 'https://schema.org/' + (match.availability || 'InStock'),
          'url': base + '/' + page.slug
        };
      }
    }
  }
  return product;
}

// ── Build Review schema from testimonials ─────────────────────────────
function _buildReviews() {
  var r = S.research || {};
  var reviews = [];
  // From research reviews
  (r.reviews || []).forEach(function(rv) {
    if (!rv.review_body_short && !rv.author_name) return;
    reviews.push({
      '@type': 'Review',
      'author': { '@type': 'Person', 'name': rv.author_name || 'Anonymous' },
      'reviewRating': { '@type': 'Rating', 'ratingValue': rv.rating_value || '5', 'bestRating': '5' },
      'reviewBody': rv.review_body_short || ''
    });
  });
  // From testimonials
  (r.testimonials || []).forEach(function(t) {
    if (!t.quote) return;
    reviews.push({
      '@type': 'Review',
      'author': { '@type': 'Person', 'name': t.author || 'Client' },
      'reviewBody': t.quote
    });
  });
  return reviews.slice(0, 10);
}

// ── Build HowTo from process steps in copy ────────────────────────────
function _extractHowTo(slug) {
  // Look for numbered process sections in copy
  var copyData = S.copy && S.copy[slug];
  if (!copyData || !copyData.html) return null;
  var steps = [];
  // Match "Step N" or numbered headings
  var stepRe = /<h[23][^>]*>(?:Step\s*\d+[.:]\s*|^\d+[.:]\s*)([\s\S]*?)<\/h[23]>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
  var m;
  while ((m = stepRe.exec(copyData.html)) !== null && steps.length < 10) {
    var name = m[1].replace(/<[^>]+>/g, '').trim();
    var text = m[2].replace(/<[^>]+>/g, '').trim();
    if (name && text) steps.push({ '@type': 'HowToStep', 'name': name, 'text': text.slice(0, 300) });
  }
  if (steps.length < 3) return null;
  return { '@type': 'HowTo', 'name': 'How It Works', 'step': steps };
}

// ── Master Schema Builder per Page ────────────────────────────────────
function buildPageSchema(page) {
  var base = _schemaBaseUrl();
  var type = (page.page_type || '').toLowerCase();
  var graph = [];

  // Every page gets WebPage + Breadcrumb
  graph.push(_buildWebPage(page));
  graph.push(_buildBreadcrumb(page));

  // Homepage: full Organization + WebSite
  if (type === 'home' || page.slug === '' || page.slug === '/') {
    graph.push(_buildOrgSchema());
    graph.push(_buildWebSite());
    // Reviews on homepage
    var reviews = _buildReviews();
    if (reviews.length) {
      var org = graph.find(function(g) { return g['@type'] && (g['@type'] === 'Organization' || g['@type'] === 'LocalBusiness' || typeof g['@type'] === 'string' && g['@type'].indexOf('Business') >= 0); });
      if (org) org.review = reviews;
    }
  }

  // Service / Industry pages
  if (['service','industry','landing'].indexOf(type) >= 0) {
    graph.push(_buildService(page));
    var faqs = _extractFaqsFromCopy(page.slug);
    if (faqs.length >= 3) graph.push(_buildFaqPage(faqs, page.slug));
    // HowTo if process section exists
    var howTo = _extractHowTo(page.slug);
    if (howTo) graph.push(howTo);
  }

  // Location pages
  if (type === 'location') {
    // Location-specific LocalBusiness
    var locBiz = _buildOrgSchema();
    locBiz['@id'] = base + '/' + page.slug + '#localbusiness';
    // Override name with location-specific name
    if (page.page_name) locBiz.name = page.page_name;
    // Try to extract city from slug
    var slugParts = page.slug.split('/');
    var cityHint = slugParts[slugParts.length - 1].replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    locBiz.areaServed = { '@type': 'City', 'name': cityHint };
    graph.push(locBiz);
    var locFaqs = _extractFaqsFromCopy(page.slug);
    if (locFaqs.length >= 3) graph.push(_buildFaqPage(locFaqs, page.slug));
  }

  // Blog / Article pages
  if (['blog','article','recipe','event','portfolio'].indexOf(type) >= 0) {
    graph.push(_buildArticle(page));
    var blogFaqs = _extractFaqsFromCopy(page.slug);
    if (blogFaqs.length >= 3) graph.push(_buildFaqPage(blogFaqs, page.slug));
  }

  // Product pages
  if (type === 'product') {
    graph.push(_buildProduct(page));
  }

  // Case study pages
  if (type === 'case-study' || type === 'case-studies') {
    var csArticle = _buildArticle(page);
    csArticle['@type'] = 'Article';
    graph.push(csArticle);
  }

  // About page
  if (type === 'about') {
    graph.push(_buildOrgSchema());
    // Team members as Person schema
    var r = S.research || {};
    if (r.team_credentials) {
      var members = r.team_credentials.split(',').map(function(m) { return m.trim(); }).filter(Boolean);
      members.slice(0, 5).forEach(function(member) {
        var parts = member.split(' — ');
        graph.push({
          '@type': 'Person',
          'name': parts[0] || member,
          'jobTitle': parts[1] || '',
          'worksFor': { '@id': base + '/#organization' }
        });
      });
    }
  }

  // Contact page
  if (type === 'contact') {
    var contactOrg = _buildOrgSchema();
    contactOrg['@id'] = base + '/' + page.slug + '#contact-org';
    graph.push(contactOrg);
  }

  // FAQ page (dedicated)
  if (type === 'faq') {
    var r2 = S.research || {};
    var allFaqs = (r2.current_faqs || []).map(function(f) { return { question: f.question, answer: f.answer || '' }; });
    if (allFaqs.length) graph.push(_buildFaqPage(allFaqs, page.slug));
  }

  // Build the final JSON-LD
  var jsonLd = { '@context': 'https://schema.org', '@graph': graph };
  return jsonLd;
}

// ── Format as script tag ──────────────────────────────────────────────
function _formatSchemaOutput(page, jsonLd) {
  var schemaJson = JSON.stringify(jsonLd, null, 2);
  var output = '<script type="application/ld+json">\n' + schemaJson + '\n</script>';

  // Meta tags
  var title = page.meta_title || page.page_name || '';
  var desc = page.meta_description || page.page_goal || '';
  var base = _schemaBaseUrl();
  output += '\n\n<!-- SEO Meta Tags -->\n';
  output += '<!-- title: ' + title.slice(0, 70) + ' -->\n';
  output += '<!-- meta description: ' + desc.slice(0, 160) + ' -->\n';
  output += '<!-- og:title: ' + title.slice(0, 70) + ' -->\n';
  output += '<!-- og:description: ' + desc.slice(0, 160) + ' -->\n';
  output += '<!-- og:url: ' + base + '/' + page.slug + ' -->\n';
  output += '<!-- og:type: ' + (['blog','article'].indexOf((page.page_type||'').toLowerCase()) >= 0 ? 'article' : 'website') + ' -->\n';
  output += '<!-- canonical: ' + base + '/' + page.slug + ' -->';

  return output;
}

// ── Validate schema per Google Rich Results requirements ──────────────
function _validateSchema(jsonLd) {
  var errors = [], warnings = [], richResults = [];
  var graph = jsonLd['@graph'] || [jsonLd];

  graph.forEach(function(item) {
    var type = item['@type'];
    if (!type) return;

    if (type === 'FAQPage') {
      var qa = item.mainEntity || [];
      if (qa.length >= 3) richResults.push({ type: 'FAQ', icon: '\u2753', label: qa.length + ' questions' });
      else if (qa.length > 0) warnings.push('FAQPage: ' + qa.length + ' questions (3+ needed for rich results)');
      if (!qa.length) errors.push('FAQPage: no questions');
    }

    if (type === 'BreadcrumbList') {
      var items = item.itemListElement || [];
      if (items.length >= 2) richResults.push({ type: 'Breadcrumb', icon: '\uD83D\uDD17', label: items.length + ' levels' });
    }

    if (type === 'Organization' || type === 'LocalBusiness' || (typeof type === 'string' && type.indexOf('Business') >= 0)) {
      if (item.aggregateRating) richResults.push({ type: 'Review snippet', icon: '\u2B50', label: item.aggregateRating.ratingValue + '/5 (' + (item.aggregateRating.reviewCount || 0) + ' reviews)' });
      if (!item.name) errors.push(type + ': missing name');
      if (!item.url) warnings.push(type + ': missing url');
      if (type !== 'Organization' && !item.address) warnings.push(type + ': missing address (needed for local rich results)');
    }

    if (type === 'Service') {
      if (!item.name) errors.push('Service: missing name');
      if (!item.provider) warnings.push('Service: missing provider');
    }

    if (type === 'BlogPosting' || type === 'Article') {
      if (item.headline && item.author && item.datePublished) richResults.push({ type: 'Article', icon: '\uD83D\uDCF0', label: 'Article rich result eligible' });
      if (!item.headline) errors.push(type + ': missing headline');
      if (!item.author) warnings.push(type + ': missing author');
      if (!item.image) warnings.push(type + ': missing image (recommended for rich results)');
    }

    if (type === 'Product') {
      if (item.offers) richResults.push({ type: 'Product', icon: '\uD83D\uDED2', label: 'Product with pricing' });
      if (!item.name) errors.push('Product: missing name');
    }

    if (type === 'HowTo') {
      var steps = item.step || [];
      if (steps.length >= 3) richResults.push({ type: 'HowTo', icon: '\uD83D\uDCD6', label: steps.length + ' steps' });
    }
  });

  return { errors: errors, warnings: warnings, richResults: richResults };
}

// ── Generate schema for a single page (deterministic) ─────────────────
function runSchemaPage(slug) {
  var page = S.pages.find(function(p) { return p.slug === slug; });
  if (!page) return;
  var jsonLd = buildPageSchema(page);
  var output = _formatSchemaOutput(page, jsonLd);
  var validation = _validateSchema(jsonLd);

  S.schema[slug] = { schema: output, page: page, validation: validation, _generatedAt: Date.now() };

  // Extract meta title + description
  var _sIdx = S.pages.findIndex(function(pp) { return pp.slug === slug; });
  if (_sIdx >= 0) {
    if (!S.pages[_sIdx].meta_title && page.page_name) S.pages[_sIdx].meta_title = page.page_name.slice(0, 70);
    if (!S.pages[_sIdx].meta_description && page.page_goal) S.pages[_sIdx].meta_description = page.page_goal.slice(0, 160);
  }

  scheduleSave();
  renderSchemaQueue();
  updateSchemaProgress();
  checkSchemaAllDone();
}

// ── Generate ALL schemas at once ──────────────────────────────────────
function runAllSchemas() {
  var count = 0;
  S.pages.forEach(function(page) {
    var jsonLd = buildPageSchema(page);
    var output = _formatSchemaOutput(page, jsonLd);
    var validation = _validateSchema(jsonLd);
    S.schema[page.slug] = { schema: output, page: page, validation: validation, _generatedAt: Date.now() };

    // Meta
    if (!page.meta_title && page.page_name) page.meta_title = page.page_name.slice(0, 70);
    if (!page.meta_description && page.page_goal) page.meta_description = page.page_goal.slice(0, 160);
    count++;
  });
  scheduleSave();
  renderSchemaQueue();
  updateSchemaProgress();
  checkSchemaAllDone();
  if (typeof aiBarNotify === 'function') aiBarNotify('Generated schema for ' + count + ' pages (no AI needed)', { duration: 3000 });
}

// ── Init ──────────────────────────────────────────────────────────────
function initSchema() {
  var prog = document.getElementById('schema-progress');
  if (prog) prog.style.display = 'block';
  var next = S.pages.find(function(p) { return !(S.schema[p.slug] || {}).schema; });
  if (next && !S.schemaExpandedSlug) S.schemaExpandedSlug = next.slug;
  renderSchemaQueue();
  updateSchemaProgress();
  checkSchemaAllDone();
}

// ── Render Queue ──────────────────────────────────────────────────────
function toggleSchemaExpand(slug) {
  S.schemaExpandedSlug = S.schemaExpandedSlug === slug ? null : slug;
  renderSchemaQueue();
}

function redoSchemaPage(slug) {
  delete S.schema[slug];
  S.schemaExpandedSlug = slug;
  scheduleSave();
  updateSchemaProgress();
  renderSchemaQueue();
  checkSchemaAllDone();
}

function toggleSchemaCode(slug) {
  var el = document.getElementById('schema-code-' + slug);
  var btn = document.getElementById('schema-code-btn-' + slug);
  if (!el) return;
  if (el.style.display === 'none') { el.style.display = 'block'; if (btn) btn.textContent = 'Hide code'; }
  else { el.style.display = 'none'; if (btn) btn.textContent = 'Show code'; }
}

function renderSchemaQueue() {
  var html = '';
  S.pages.forEach(function(p, i) {
    var r = S.schema[p.slug] || {};
    var isDone = !!r.schema, isErr = !!r.error;
    var isExpanded = S.schemaExpandedSlug === p.slug;
    var cirStyle = isDone ? 'background:var(--green)' : isErr ? 'background:var(--error)' : 'background:var(--n1)';
    var cirContent = isDone ? '&#10003;' : isErr ? '!' : (i + 1);
    var rowBorder = isExpanded ? 'border-color:var(--dark);' : isDone ? 'border-color:rgba(0,0,0,0.18);' : '';

    html += '<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:6px;' + rowBorder + '">';

    // Header
    html += '<div onclick="toggleSchemaExpand(\'' + p.slug + '\')" style="display:flex;align-items:center;gap:10px;padding:11px 14px;cursor:pointer;user-select:none">'
      + '<div class="status-circle" style="' + cirStyle + ';font-size:9px;font-weight:500;flex-shrink:0">' + cirContent + '</div>'
      + '<div style="flex:1;min-width:0"><span style="font-size:13px;color:' + (isDone || isExpanded ? 'var(--dark)' : 'var(--n2)') + '">' + esc(p.page_name) + '</span>';

    // Rich results preview badges
    if (isDone && r.validation && r.validation.richResults && r.validation.richResults.length) {
      html += '<span style="margin-left:8px">';
      r.validation.richResults.forEach(function(rr) {
        html += '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:rgba(21,142,29,0.08);color:var(--green);border:1px solid rgba(21,142,29,0.15);margin-right:3px">' + rr.icon + ' ' + rr.type + '</span>';
      });
      html += '</span>';
    }
    html += '</div>'
      + '<i class="ti ' + (isExpanded ? 'ti-chevron-up' : 'ti-chevron-down') + '" style="font-size:12px;color:var(--n2);flex-shrink:0"></i>'
      + '</div>';

    // Expanded body
    if (isExpanded) {
      html += '<div style="border-top:1px solid var(--border);padding:14px">';
      if (isDone) {
        // Validation results
        var v = r.validation || { errors: [], warnings: [], richResults: [] };
        if (v.richResults.length) {
          html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">';
          v.richResults.forEach(function(rr) {
            html += '<span style="font-size:10px;padding:3px 8px;border-radius:4px;background:rgba(21,142,29,0.06);border:1px solid rgba(21,142,29,0.2);color:var(--green)">' + rr.icon + ' ' + rr.type + ': ' + rr.label + '</span>';
          });
          html += '</div>';
        }
        if (v.errors.length) {
          html += '<div style="margin-bottom:8px">';
          v.errors.forEach(function(e) { html += '<div style="font-size:10px;color:var(--error)"><i class="ti ti-x" style="font-size:9px"></i> ' + esc(e) + '</div>'; });
          html += '</div>';
        }
        if (v.warnings.length) {
          html += '<div style="margin-bottom:8px">';
          v.warnings.forEach(function(w) { html += '<div style="font-size:10px;color:var(--warn)"><i class="ti ti-alert-triangle" style="font-size:9px"></i> ' + esc(w) + '</div>'; });
          html += '</div>';
        }

        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">'
          + '<button class="btn btn-ghost sm" onclick="copyToClip2((S.schema[\'' + p.slug + '\']||{}).schema)"><i class="ti ti-copy"></i> Copy Schema</button>'
          + '<button class="btn btn-ghost sm" id="schema-code-btn-' + p.slug + '" onclick="toggleSchemaCode(\'' + p.slug + '\')">Show code</button>'
          + '<button class="btn btn-ghost sm" style="color:var(--error)" onclick="redoSchemaPage(\'' + p.slug + '\')"><i class="ti ti-refresh"></i> Redo</button>'
          + '</div>'
          + '<div id="schema-code-' + p.slug + '" style="display:none;max-height:280px;overflow:auto;font-family:monospace;font-size:11px;color:var(--n3);white-space:pre-wrap;line-height:1.65;background:var(--bg);border-radius:5px;padding:10px;border:1px solid var(--border)">' + esc(r.schema) + '</div>';
      } else {
        html += '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">'
          + '<div style="font-size:12px;color:var(--n2)">' + esc(p.page_type || 'page') + ' · JSON-LD + meta + OG</div>'
          + '<button class="btn btn-dark sm" onclick="runSchemaPage(\'' + p.slug + '\')"><i class="ti ti-code"></i> Generate Schema</button>'
          + '</div>';
      }
      html += '</div>';
    }
    html += '</div>';
  });
  var queueEl = document.getElementById('schema-queue');
  if (queueEl) queueEl.innerHTML = html;
}

function updateSchemaProgress() {
  var done = S.pages.filter(function(p) { return (S.schema[p.slug] || {}).schema; }).length;
  var pct = S.pages.length > 0 ? Math.round(done / S.pages.length * 100) : 0;
  var countEl = document.getElementById('schema-count-label');
  var pctEl = document.getElementById('schema-pct-label');
  var fillEl = document.getElementById('schema-progress-fill');
  if (countEl) countEl.textContent = done + '/' + S.pages.length + ' pages complete';
  if (pctEl) pctEl.textContent = pct + '%';
  if (fillEl) fillEl.style.width = pct + '%';
}

function checkSchemaAllDone() {
  var done = S.pages.filter(function(p) { return (S.schema[p.slug] || {}).schema; }).length;
  var el = document.getElementById('schema-all-done');
  var label = document.getElementById('schema-done-label');
  if (done === S.pages.length && done > 0) {
    if (label) label.textContent = 'All ' + done + ' pages complete';
    if (el) el.style.display = 'flex';
  } else { if (el) el.style.display = 'none'; }
}

// ── EXPORT ─────────────────────────────────────────────────────────
var exportCopySlug = null, exportSchemaSlug = null;

function renderSchemaTab() {
  var pages = S.pages.filter(function(p) { return S.schema[p.slug] && S.schema[p.slug].schema; });
  var tabEl = document.getElementById('export-schema-tab');
  if (!tabEl) return;
  if (!pages.length) { tabEl.innerHTML = '<p style="color:var(--n2);font-size:13px">No schema generated yet.</p>'; return; }
  exportSchemaSlug = exportSchemaSlug || pages[0].slug;
  var html = '<div style="display:flex;gap:4px;margin-bottom:10px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px">';
  pages.forEach(function(p) { html += '<button class="tab-btn ' + (exportSchemaSlug === p.slug ? 'active' : '') + '" style="flex-shrink:0" onclick="switchExportSchema(\'' + esc(p.slug) + '\',this)">' + esc(p.page_name) + '</button>'; });
  html += '</div>';
  html += '<div class="card"><div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button class="btn btn-ghost sm" onclick="copyToClip2(S.schema[exportSchemaSlug].schema)"><i class="ti ti-copy"></i> Copy Schema</button></div><div class="code-view" id="export-schema-view">' + esc((S.schema[exportSchemaSlug] || {}).schema || '') + '</div></div>';
  tabEl.innerHTML = html;
}

function switchExportSchema(slug, btn) {
  exportSchemaSlug = slug;
  document.querySelectorAll('#export-schema-tab .tab-btn').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  var viewEl = document.getElementById('export-schema-view');
  if (viewEl) viewEl.textContent = (S.schema[slug] || {}).schema || '';
}
