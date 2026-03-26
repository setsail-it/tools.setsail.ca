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

// ── Build Speakable (voice search) ────────────────────────────────────
function _buildSpeakable(page) {
  var base = _schemaBaseUrl();
  // Speakable: the H1 and first paragraph are the best voice search targets
  return {
    '@type': 'SpeakableSpecification',
    'cssSelector': ['h1', '.page-copy > p:first-of-type', '.hero-subheadline']
  };
}

// ── Build OfferCatalog (for service listing pages) ────────────────────
function _buildOfferCatalog() {
  var base = _schemaBaseUrl();
  var r = S.research || {};
  var services = (r.schema_services || r.primary_services || []);
  if (!services.length) return null;
  return {
    '@type': 'OfferCatalog',
    '@id': base + '/#offer-catalog',
    'name': 'Services',
    'itemListElement': services.map(function(svc) {
      var name = typeof svc === 'string' ? svc : (svc.service_name || svc.name || svc);
      return {
        '@type': 'Offer',
        'itemOffered': { '@type': 'Service', 'name': name }
      };
    }).slice(0, 20)
  };
}

// ── Build ItemList for blog index / portfolio pages ───────────────────
function _buildItemList(listPages, listName) {
  var base = _schemaBaseUrl();
  return {
    '@type': 'ItemList',
    'name': listName || 'Pages',
    'numberOfItems': listPages.length,
    'itemListElement': listPages.slice(0, 30).map(function(p, i) {
      return {
        '@type': 'ListItem',
        'position': i + 1,
        'name': p.page_name || p.primary_keyword || p.slug,
        'url': base + '/' + p.slug
      };
    })
  };
}

// ── Build ContactPoint ────────────────────────────────────────────────
function _buildContactPoints() {
  var r = S.research || {};
  var points = [];
  if (r.schema_phone) {
    points.push({
      '@type': 'ContactPoint',
      'telephone': r.schema_phone,
      'contactType': 'customer service',
      'availableLanguage': ['English']
    });
  }
  if (r.schema_email) {
    points.push({
      '@type': 'ContactPoint',
      'email': r.schema_email,
      'contactType': 'customer service'
    });
  }
  return points;
}

// ── Build ImageObject for page ────────────────────────────────────────
function _buildImageObject(page) {
  var base = _schemaBaseUrl();
  var imgData = S.images && S.images[page.slug];
  if (imgData && imgData.url) {
    return { '@type': 'ImageObject', '@id': base + '/' + page.slug + '#image', 'url': imgData.url, 'contentUrl': imgData.url };
  }
  return null;
}

// ── Build Offer for service pages (priced services) ───────────────────
function _buildServiceOffer(page) {
  var r = S.research || {};
  if (!r.schema_price_range) return null;
  var base = _schemaBaseUrl();
  return {
    '@type': 'Offer',
    '@id': base + '/' + page.slug + '#offer',
    'url': base + '/' + page.slug,
    'availability': 'https://schema.org/InStock',
    'priceSpecification': {
      '@type': 'PriceSpecification',
      'priceCurrency': 'CAD'
    }
  };
}

// ── Build VideoObject from page copy embeds ───────────────────────────
function _extractVideos(slug) {
  var copyData = S.copy && S.copy[slug];
  if (!copyData || !copyData.html) return [];
  var videos = [];
  // YouTube embeds
  var ytRe = /(?:youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/gi;
  var m;
  while ((m = ytRe.exec(copyData.html)) !== null && videos.length < 5) {
    videos.push({
      '@type': 'VideoObject',
      'embedUrl': 'https://www.youtube.com/embed/' + m[1],
      'thumbnailUrl': 'https://img.youtube.com/vi/' + m[1] + '/hqdefault.jpg'
    });
  }
  // Vimeo embeds
  var vimeoRe = /vimeo\.com\/(?:video\/)?(\d+)/gi;
  while ((m = vimeoRe.exec(copyData.html)) !== null && videos.length < 5) {
    videos.push({
      '@type': 'VideoObject',
      'embedUrl': 'https://player.vimeo.com/video/' + m[1]
    });
  }
  return videos;
}

// ── Build mentions/citations for E-E-A-T ──────────────────────────────
function _buildMentions(page) {
  var r = S.research || {};
  var mentions = [];
  // Notable clients as mentions
  (r.notable_clients || []).slice(0, 5).forEach(function(c) {
    mentions.push({ '@type': 'Organization', 'name': c });
  });
  return mentions;
}

// ── Build ProfessionalService (agencies, law firms, etc.) ─────────────
function _buildProfessionalService(page) {
  var base = _schemaBaseUrl();
  var r = S.research || {};
  var svc = {
    '@type': ['ProfessionalService', 'Service'],
    '@id': base + '/' + page.slug + '#service',
    'name': page.page_name || page.primary_keyword || '',
    'url': base + '/' + page.slug,
    'provider': { '@id': base + '/#organization' }
  };
  if (page.page_goal) svc.description = page.page_goal;
  if (page.primary_keyword) svc.serviceType = page.primary_keyword;
  if (r.geography && r.geography.primary) {
    svc.areaServed = [{ '@type': 'City', 'name': r.geography.primary }];
    if (r.geography.secondary && r.geography.secondary.length) {
      r.geography.secondary.forEach(function(s) {
        svc.areaServed.push({ '@type': 'City', 'name': s });
      });
    }
  }
  // Service offer
  var offer = _buildServiceOffer(page);
  if (offer) svc.offers = offer;
  return svc;
}

// ── Master Schema Builder per Page ────────────────────────────────────
function buildPageSchema(page) {
  var base = _schemaBaseUrl();
  var type = (page.page_type || '').toLowerCase();
  var r = S.research || {};
  var s = S.setup || {};
  var graph = [];

  // ── EVERY PAGE: WebPage + Breadcrumb + universal properties ──
  var webPage = _buildWebPage(page);
  // Speakable on all pages
  webPage.speakable = _buildSpeakable(page);
  // Primary image
  var img = _buildImageObject(page);
  if (img) { webPage.primaryImageOfPage = { '@id': img['@id'] }; graph.push(img); }
  // Language
  webPage.inLanguage = 'en-CA';
  // Publisher (always the org)
  webPage.publisher = { '@id': base + '/#organization' };
  // Date modified
  if (page.updatedAt) webPage.dateModified = new Date(page.updatedAt).toISOString().split('T')[0];
  // Keywords
  if (page.primary_keyword) {
    var allKws = [page.primary_keyword];
    (page.supporting_keywords || []).forEach(function(k) { var kw = typeof k === 'string' ? k : (k.kw || ''); if (kw) allKws.push(kw); });
    webPage.keywords = allKws.join(', ');
  }
  // Significance / about
  if (page.primary_keyword) webPage.about = { '@type': 'Thing', 'name': page.primary_keyword };
  // Part of site
  webPage.isPartOf = { '@id': base + '/#website' };
  graph.push(webPage);
  graph.push(_buildBreadcrumb(page));

  // ── HOMEPAGE ──
  if (type === 'home' || page.slug === '' || page.slug === '/') {
    var orgSchema = _buildOrgSchema();
    // Contact points (phone, email)
    var contactPts = _buildContactPoints();
    if (contactPts.length) orgSchema.contactPoint = contactPts;
    // Reviews + AggregateRating
    var reviews = _buildReviews();
    if (reviews.length) orgSchema.review = reviews;
    // Offer catalog (all services)
    var catalog = _buildOfferCatalog();
    if (catalog) orgSchema.hasOfferCatalog = catalog;
    // Notable clients as member organizations
    if (r.notable_clients && r.notable_clients.length) {
      orgSchema.member = r.notable_clients.slice(0, 10).map(function(c) { return { '@type': 'Organization', 'name': c }; });
    }
    // Awards & certifications
    if (r.awards_certifications && r.awards_certifications.length) orgSchema.award = r.awards_certifications;
    // Founder with full detail
    if (r.founder_bio) {
      orgSchema.founder = { '@type': 'Person', 'description': r.founder_bio };
      if (r.team_credentials) {
        var founderMatch = r.team_credentials.split(',')[0];
        if (founderMatch) {
          var fp = founderMatch.trim().split(' — ');
          orgSchema.founder.name = fp[0] || '';
          if (fp[1]) orgSchema.founder.jobTitle = fp[1];
        }
      }
    }
    // Employee count
    if (r.team_credentials) {
      var teamCount = r.team_credentials.split(',').filter(Boolean).length;
      if (teamCount > 0) orgSchema.numberOfEmployees = { '@type': 'QuantitativeValue', 'value': teamCount };
    }
    // Opening hours
    if (r.schema_hours) {
      orgSchema.openingHoursSpecification = { '@type': 'OpeningHoursSpecification', 'description': r.schema_hours };
    }
    // Known-for / slogan
    if (r.current_slogan) orgSchema.slogan = r.current_slogan;
    // Geo coordinates from address
    if (r.schema_city && r.schema_region) {
      orgSchema.geo = { '@type': 'GeoCoordinates', 'addressLocality': r.schema_city, 'addressRegion': r.schema_region };
    }
    // Brand
    if (r.brand_name) orgSchema.brand = { '@type': 'Brand', 'name': r.brand_name };
    // Legal name (if different)
    if (r.legal_name) orgSchema.legalName = r.legal_name;
    // Industry / NAICS
    if (r.industry) orgSchema.knowsAbout = r.industry;
    graph.push(orgSchema);

    // WebSite
    graph.push(_buildWebSite());

    // Sitelinks SearchAction
    graph.push({
      '@type': 'WebSite', '@id': base + '/#website-search', 'url': base,
      'potentialAction': { '@type': 'SearchAction', 'target': { '@type': 'EntryPoint', 'urlTemplate': base + '/search?q={search_term_string}' }, 'query-input': 'required name=search_term_string' }
    });

    // Homepage FAQs (from copy or research)
    var homeFaqs = _extractFaqsFromCopy(page.slug);
    if (homeFaqs.length >= 2) graph.push(_buildFaqPage(homeFaqs, page.slug));

    // Homepage HowTo (process section)
    var homeHowTo = _extractHowTo(page.slug);
    if (homeHowTo) graph.push(homeHowTo);

    // Homepage videos
    var homeVideos = _extractVideos(page.slug);
    homeVideos.forEach(function(v) { graph.push(v); });

    // Individual service entities (not just catalog — each as a Service node for rich results)
    var svcPages = (S.pages || []).filter(function(p) { return ['service','industry'].indexOf((p.page_type || '').toLowerCase()) >= 0; });
    if (svcPages.length > 0 && svcPages.length <= 15) {
      svcPages.forEach(function(sp) {
        graph.push({
          '@type': 'Service',
          '@id': base + '/' + sp.slug + '#service',
          'name': sp.page_name || sp.primary_keyword || '',
          'url': base + '/' + sp.slug,
          'provider': { '@id': base + '/#organization' }
        });
      });
    }

    // Proof Bank stats as claims
    var pb = (s.proofBank || {});
    if (pb.stats && pb.stats.length) {
      webPage.citation = pb.stats.map(function(stat) {
        return { '@type': 'CreativeWork', 'name': stat.stat, 'author': { '@type': 'Organization', 'name': stat.source || s.client || '' } };
      });
    }

    // E-E-A-T mentions
    var homeMentions = _buildMentions(page);
    if (homeMentions.length) webPage.mentions = homeMentions;

    // Case studies as knowledge articles
    if (r.case_studies && r.case_studies.length) {
      var csPages = (S.pages || []).filter(function(p) { return (p.page_type || '').toLowerCase() === 'case-study'; });
      if (csPages.length) {
        webPage.relatedLink = csPages.map(function(p) { return base + '/' + p.slug; });
      }
    }
  }

  // ── SERVICE / INDUSTRY / LANDING PAGES ──
  if (['service','industry','landing'].indexOf(type) >= 0) {
    var svcSchema = _buildProfessionalService(page);
    // Supporting keywords as additional service types
    if (page.supporting_keywords && page.supporting_keywords.length) {
      svcSchema.hasOfferCatalog = {
        '@type': 'OfferCatalog', 'name': page.page_name || '',
        'itemListElement': (page.supporting_keywords || []).slice(0, 10).map(function(k) {
          var kw = typeof k === 'string' ? k : (k.kw || '');
          return { '@type': 'Offer', 'itemOffered': { '@type': 'Service', 'name': kw } };
        })
      };
    }
    // Brand on service
    if (r.brand_name) svcSchema.brand = { '@type': 'Brand', 'name': r.brand_name };
    graph.push(svcSchema);

    // FAQPage from copy
    var faqs = _extractFaqsFromCopy(page.slug);
    if (faqs.length >= 2) graph.push(_buildFaqPage(faqs, page.slug));
    // HowTo from process section
    var howTo = _extractHowTo(page.slug);
    if (howTo) graph.push(howTo);
    // Videos embedded in copy
    var videos = _extractVideos(page.slug);
    videos.forEach(function(v) { graph.push(v); });
    // Reviews on service
    var svcReviews = _buildReviews();
    if (svcReviews.length) {
      svcSchema.review = svcReviews.slice(0, 5);
      var totalR = 0, countR = 0;
      svcReviews.forEach(function(rv) { if (rv.reviewRating && rv.reviewRating.ratingValue) { totalR += parseFloat(rv.reviewRating.ratingValue); countR++; } });
      if (countR > 0) {
        svcSchema.aggregateRating = { '@type': 'AggregateRating', 'ratingValue': Math.round(totalR / countR * 10) / 10, 'reviewCount': (r.reviews || []).length + (r.testimonials || []).length, 'bestRating': 5 };
      }
    }
    // E-E-A-T mentions
    var mentions = _buildMentions(page);
    if (mentions.length) webPage.mentions = mentions;
    // Related case studies for this service
    var relatedCS = (r.case_studies || []).filter(function(cs) {
      return page.page_name && cs.client;
    }).slice(0, 3);
    if (relatedCS.length) {
      webPage.relatedLink = relatedCS.map(function(cs) { return cs.url || ''; }).filter(Boolean);
    }
    // Proof Bank stats as citations on service pages
    var spb = (s.proofBank || {});
    if (spb.stats && spb.stats.length) {
      webPage.citation = webPage.citation || [];
      spb.stats.forEach(function(stat) {
        webPage.citation.push({ '@type': 'CreativeWork', 'name': stat.stat, 'author': { '@type': 'Organization', 'name': stat.source || s.client || '' } });
      });
    }
    // Awareness stage as audience
    if (page.awareness_stage) {
      webPage.audience = { '@type': 'Audience', 'audienceType': page.awareness_stage.replace(/_/g, ' ') };
    }
    // Persona as target audience
    if (page.target_persona) {
      webPage.audience = webPage.audience || {};
      webPage.audience.name = page.target_persona;
    }
  }

  // ── LOCATION PAGES ──
  if (type === 'location') {
    var locBiz = _buildOrgSchema();
    locBiz['@id'] = base + '/' + page.slug + '#localbusiness';
    if (page.page_name) locBiz.name = page.page_name;
    // City from slug
    var slugParts = page.slug.split('/');
    var cityHint = slugParts[slugParts.length - 1].replace(/-/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    locBiz.areaServed = { '@type': 'City', 'name': cityHint };
    // Contact points
    var locContacts = _buildContactPoints();
    if (locContacts.length) locBiz.contactPoint = locContacts;
    // Reviews
    var locReviews = _buildReviews();
    if (locReviews.length) locBiz.review = locReviews;
    // Services offered at this location
    var locServices = (r.primary_services || []).slice(0, 10);
    if (locServices.length) {
      locBiz.makesOffer = locServices.map(function(s) {
        return { '@type': 'Offer', 'itemOffered': { '@type': 'Service', 'name': typeof s === 'string' ? s : (s.name || s) } };
      });
    }
    graph.push(locBiz);
    var locFaqs = _extractFaqsFromCopy(page.slug);
    if (locFaqs.length >= 2) graph.push(_buildFaqPage(locFaqs, page.slug));
    var locHowTo = _extractHowTo(page.slug);
    if (locHowTo) graph.push(locHowTo);
  }

  // ── BLOG / ARTICLE PAGES ──
  if (['blog','article','recipe','event','portfolio'].indexOf(type) >= 0) {
    var article = _buildArticle(page);
    // Word count estimate from copy
    var copyData = S.copy && S.copy[page.slug];
    if (copyData && copyData.html) {
      var textContent = copyData.html.replace(/<[^>]+>/g, '').trim();
      article.wordCount = textContent.split(/\s+/).length;
    }
    // Speakable for articles
    article.speakable = _buildSpeakable(page);
    // Image
    if (img) article.image = { '@id': img['@id'] };
    // Videos
    var articleVideos = _extractVideos(page.slug);
    if (articleVideos.length) article.video = articleVideos;
    // Supporting keywords as keywords
    var kws = [page.primary_keyword].concat((page.supporting_keywords || []).map(function(k) { return typeof k === 'string' ? k : (k.kw || ''); })).filter(Boolean);
    if (kws.length) article.keywords = kws.join(', ');
    // Content pillar as articleSection
    if (page.contentPillar) article.articleSection = page.contentPillar;
    // About (topic)
    if (page.primary_keyword) article.about = { '@type': 'Thing', 'name': page.primary_keyword };
    // Mentions
    var artMentions = _buildMentions(page);
    if (artMentions.length) article.mentions = artMentions;
    graph.push(article);
    // FAQs
    var blogFaqs = _extractFaqsFromCopy(page.slug);
    if (blogFaqs.length >= 2) graph.push(_buildFaqPage(blogFaqs, page.slug));
  }

  // ── PRODUCT PAGES ──
  if (type === 'product') {
    var product = _buildProduct(page);
    // Reviews on product
    var prodReviews = _buildReviews();
    if (prodReviews.length) {
      product.review = prodReviews.slice(0, 5);
      var totPR = 0, cntPR = 0;
      prodReviews.forEach(function(rv) { if (rv.reviewRating && rv.reviewRating.ratingValue) { totPR += parseFloat(rv.reviewRating.ratingValue); cntPR++; } });
      if (cntPR > 0) product.aggregateRating = { '@type': 'AggregateRating', 'ratingValue': Math.round(totPR / cntPR * 10) / 10, 'reviewCount': prodReviews.length, 'bestRating': 5 };
    }
    if (img) product.image = { '@id': img['@id'] };
    graph.push(product);
    // Product FAQs
    var prodFaqs = _extractFaqsFromCopy(page.slug);
    if (prodFaqs.length >= 2) graph.push(_buildFaqPage(prodFaqs, page.slug));
  }

  // ── CASE STUDY PAGES ──
  if (type === 'case-study' || type === 'case-studies') {
    var csArticle = _buildArticle(page);
    csArticle['@type'] = 'Article';
    csArticle.articleSection = 'Case Study';
    // Try to find matching case study data
    var caseMatch = (r.case_studies || []).find(function(cs) {
      return page.page_name && cs.client && page.page_name.toLowerCase().indexOf(cs.client.toLowerCase()) >= 0;
    });
    if (caseMatch) {
      csArticle.about = { '@type': 'Organization', 'name': caseMatch.client };
      if (caseMatch.result) csArticle.description = caseMatch.result;
    }
    if (img) csArticle.image = { '@id': img['@id'] };
    graph.push(csArticle);
  }

  // ── ABOUT PAGE ──
  if (type === 'about') {
    var aboutOrg = _buildOrgSchema();
    var aboutContacts = _buildContactPoints();
    if (aboutContacts.length) aboutOrg.contactPoint = aboutContacts;
    // Awards
    if (r.awards_certifications && r.awards_certifications.length) aboutOrg.award = r.awards_certifications;
    // Founder
    if (r.founder_bio) {
      aboutOrg.founder = { '@type': 'Person', 'description': r.founder_bio };
    }
    graph.push(aboutOrg);
    // Team members as Person schema
    if (r.team_credentials) {
      var members = r.team_credentials.split(',').map(function(m) { return m.trim(); }).filter(Boolean);
      members.slice(0, 10).forEach(function(member) {
        var pts = member.split(' — ');
        var person = { '@type': 'Person', 'name': pts[0] || member, 'worksFor': { '@id': base + '/#organization' } };
        if (pts[1]) person.jobTitle = pts[1];
        graph.push(person);
      });
    }
    // Notable clients as mentions
    if (r.notable_clients && r.notable_clients.length) {
      webPage.mentions = r.notable_clients.map(function(c) { return { '@type': 'Organization', 'name': c }; });
    }
  }

  // ── CONTACT PAGE ──
  if (type === 'contact') {
    var contactOrg = _buildOrgSchema();
    contactOrg['@id'] = base + '/' + page.slug + '#contact-org';
    var cContacts = _buildContactPoints();
    if (cContacts.length) contactOrg.contactPoint = cContacts;
    graph.push(contactOrg);
  }

  // ── FAQ PAGE (dedicated) ──
  if (type === 'faq') {
    var allFaqs = (r.current_faqs || []).map(function(f) { return { question: f.question, answer: f.answer || '' }; });
    if (allFaqs.length) graph.push(_buildFaqPage(allFaqs, page.slug));
  }

  // ── TESTIMONIALS PAGE ──
  if (type === 'testimonials') {
    var testOrg = _buildOrgSchema();
    var allReviews = _buildReviews();
    if (allReviews.length) testOrg.review = allReviews;
    graph.push(testOrg);
  }

  // ── TEAM PAGE ──
  if (type === 'team') {
    if (r.team_credentials) {
      var teamMembers = r.team_credentials.split(',').map(function(m) { return m.trim(); }).filter(Boolean);
      teamMembers.slice(0, 15).forEach(function(member) {
        var pts = member.split(' — ');
        graph.push({ '@type': 'Person', 'name': pts[0] || member, 'jobTitle': pts[1] || '', 'worksFor': { '@id': base + '/#organization' } });
      });
    }
  }

  // ── PORTFOLIO / OUR WORK INDEX ──
  if (type === 'portfolio' || (page.slug && /our-work|portfolio|projects/i.test(page.slug) && type !== 'case-study')) {
    var caseStudyPages = (S.pages || []).filter(function(p) { return (p.page_type || '').toLowerCase() === 'case-study'; });
    if (caseStudyPages.length) graph.push(_buildItemList(caseStudyPages, 'Our Work'));
  }

  // ── PRICING PAGE ──
  if (type === 'pricing' || (page.slug && /pricing|packages|plans/i.test(page.slug))) {
    var catalog2 = _buildOfferCatalog();
    if (catalog2) graph.push(catalog2);
    var priceFaqs = _extractFaqsFromCopy(page.slug);
    if (priceFaqs.length >= 2) graph.push(_buildFaqPage(priceFaqs, page.slug));
  }

  // ── RECIPE PAGES ──
  if (type === 'recipe') {
    var recipeSchema = {
      '@type': 'Recipe',
      '@id': base + '/' + page.slug + '#recipe',
      'name': page.page_name || page.primary_keyword || '',
      'url': base + '/' + page.slug,
      'author': { '@id': base + '/#organization' },
      'datePublished': new Date().toISOString().split('T')[0]
    };
    if (page.meta_description) recipeSchema.description = page.meta_description;
    if (img) recipeSchema.image = { '@id': img['@id'] };
    if (page.primary_keyword) recipeSchema.keywords = page.primary_keyword;
    // Extract steps from copy as recipeInstructions
    var recipeHowTo = _extractHowTo(page.slug);
    if (recipeHowTo && recipeHowTo.step) recipeSchema.recipeInstructions = recipeHowTo.step;
    graph.push(recipeSchema);
    var recipeFaqs = _extractFaqsFromCopy(page.slug);
    if (recipeFaqs.length >= 2) graph.push(_buildFaqPage(recipeFaqs, page.slug));
  }

  // ── EVENT PAGES ──
  if (type === 'event') {
    var eventSchema = {
      '@type': 'Event',
      '@id': base + '/' + page.slug + '#event',
      'name': page.page_name || page.primary_keyword || '',
      'url': base + '/' + page.slug,
      'organizer': { '@id': base + '/#organization' },
      'eventAttendanceMode': 'https://schema.org/MixedEventAttendanceMode',
      'eventStatus': 'https://schema.org/EventScheduled'
    };
    if (page.meta_description) eventSchema.description = page.meta_description;
    if (img) eventSchema.image = { '@id': img['@id'] };
    // Location from research
    if (r.schema_street_address || r.schema_city) {
      eventSchema.location = { '@type': 'Place', 'name': r.schema_city || '', 'address': { '@type': 'PostalAddress', 'addressLocality': r.schema_city || '', 'addressRegion': r.schema_region || '' } };
    }
    // Virtual location
    eventSchema.location = eventSchema.location || { '@type': 'VirtualLocation', 'url': base + '/' + page.slug };
    graph.push(eventSchema);
    var eventFaqs = _extractFaqsFromCopy(page.slug);
    if (eventFaqs.length >= 2) graph.push(_buildFaqPage(eventFaqs, page.slug));
  }

  // ── COURSE / TRAINING PAGES ──
  if (type === 'course' || type === 'training' || type === 'workshop' || (page.slug && /course|training|workshop|class|program/i.test(page.slug))) {
    var courseSchema = {
      '@type': 'Course',
      '@id': base + '/' + page.slug + '#course',
      'name': page.page_name || page.primary_keyword || '',
      'url': base + '/' + page.slug,
      'provider': { '@id': base + '/#organization' }
    };
    if (page.meta_description) courseSchema.description = page.meta_description;
    if (page.primary_keyword) courseSchema.about = { '@type': 'Thing', 'name': page.primary_keyword };
    // Course instance
    courseSchema.hasCourseInstance = { '@type': 'CourseInstance', 'courseMode': 'online', 'instructor': { '@id': base + '/#organization' } };
    graph.push(courseSchema);
    var courseFaqs = _extractFaqsFromCopy(page.slug);
    if (courseFaqs.length >= 2) graph.push(_buildFaqPage(courseFaqs, page.slug));
  }

  // ── CAREERS / JOBS PAGES ──
  if (type === 'careers' || (page.slug && /careers|jobs|hiring|join-us|work-with-us/i.test(page.slug))) {
    // JobPosting — basic, details would come from individual job posts
    var jobSchema = {
      '@type': 'JobPosting',
      '@id': base + '/' + page.slug + '#jobposting',
      'title': page.page_name || 'Open Position',
      'hiringOrganization': { '@id': base + '/#organization' },
      'url': base + '/' + page.slug,
      'datePosted': new Date().toISOString().split('T')[0],
      'jobLocationType': 'TELECOMMUTE'
    };
    if (r.geography && r.geography.primary) {
      jobSchema.jobLocation = { '@type': 'Place', 'address': { '@type': 'PostalAddress', 'addressLocality': r.geography.primary } };
    }
    graph.push(jobSchema);
  }

  // ── NEWS / PRESS RELEASE PAGES ──
  if (type === 'news' || type === 'press' || type === 'press-release' || (page.slug && /\/news\/|\/press\/|press-release/i.test(page.slug))) {
    var newsArticle = _buildArticle(page);
    newsArticle['@type'] = 'NewsArticle';
    newsArticle.articleSection = 'Press';
    if (img) newsArticle.image = { '@id': img['@id'] };
    graph.push(newsArticle);
  }

  // ── RESOURCE / GUIDE / HOW-TO PAGES ──
  if (type === 'resource' || type === 'guide' || type === 'how-to' || (page.slug && /\/guide|\/resource|how-to-/i.test(page.slug) && type !== 'blog')) {
    var techArticle = _buildArticle(page);
    techArticle['@type'] = 'TechArticle';
    techArticle.proficiencyLevel = 'Beginner';
    graph.push(techArticle);
    // HowTo if process section exists
    var guideHowTo = _extractHowTo(page.slug);
    if (guideHowTo) graph.push(guideHowTo);
    var guideFaqs = _extractFaqsFromCopy(page.slug);
    if (guideFaqs.length >= 2) graph.push(_buildFaqPage(guideFaqs, page.slug));
  }

  // ── GALLERY / PHOTO PAGES ──
  if (type === 'gallery' || (page.slug && /gallery|photos/i.test(page.slug))) {
    var gallerySchema = {
      '@type': 'ImageGallery',
      '@id': base + '/' + page.slug + '#gallery',
      'name': page.page_name || 'Gallery',
      'url': base + '/' + page.slug
    };
    graph.push(gallerySchema);
  }

  // ── SOFTWARE / TOOL / CALCULATOR PAGES ──
  if (type === 'tool' || type === 'calculator' || type === 'software' || (page.slug && /calculator|tool$|tools\//i.test(page.slug))) {
    var softwareSchema = {
      '@type': 'SoftwareApplication',
      '@id': base + '/' + page.slug + '#software',
      'name': page.page_name || '',
      'url': base + '/' + page.slug,
      'applicationCategory': 'BusinessApplication',
      'operatingSystem': 'Web',
      'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'CAD' }
    };
    if (page.meta_description) softwareSchema.description = page.meta_description;
    graph.push(softwareSchema);
    var toolFaqs = _extractFaqsFromCopy(page.slug);
    if (toolFaqs.length >= 2) graph.push(_buildFaqPage(toolFaqs, page.slug));
  }

  // ── COMPARISON / VS PAGES ──
  if (page.slug && /\/vs-|\/compare|\/comparison|-vs-/i.test(page.slug)) {
    // ItemList of compared items
    var compList = {
      '@type': 'ItemList',
      '@id': base + '/' + page.slug + '#comparison',
      'name': page.page_name || 'Comparison',
      'url': base + '/' + page.slug
    };
    graph.push(compList);
    var compFaqs = _extractFaqsFromCopy(page.slug);
    if (compFaqs.length >= 2) graph.push(_buildFaqPage(compFaqs, page.slug));
  }

  // ── CATEGORY / ARCHIVE PAGES ──
  if (type === 'category' || type === 'archive' || type === 'tag') {
    webPage['@type'] = 'CollectionPage';
    // Build ItemList of child pages
    var childPages = (S.pages || []).filter(function(p) {
      return p.slug && p.slug.indexOf(page.slug + '/') === 0;
    });
    if (childPages.length) graph.push(_buildItemList(childPages, page.page_name || 'Category'));
  }

  // ── WHITE PAPER / EBOOK / DOWNLOAD PAGES ──
  if (type === 'whitepaper' || type === 'ebook' || type === 'download' || (page.slug && /whitepaper|ebook|download|report/i.test(page.slug) && type !== 'blog')) {
    var docSchema = {
      '@type': 'DigitalDocument',
      '@id': base + '/' + page.slug + '#document',
      'name': page.page_name || '',
      'url': base + '/' + page.slug,
      'author': { '@id': base + '/#organization' },
      'hasDigitalDocumentPermission': { '@type': 'DigitalDocumentPermission', 'permissionType': 'https://schema.org/ReadPermission' }
    };
    if (page.meta_description) docSchema.description = page.meta_description;
    graph.push(docSchema);
  }

  // ── GLOSSARY / DEFINITION PAGES ──
  if (type === 'glossary' || (page.slug && /glossary|dictionary|definitions/i.test(page.slug))) {
    var glossarySchema = {
      '@type': 'DefinedTermSet',
      '@id': base + '/' + page.slug + '#glossary',
      'name': page.page_name || 'Glossary',
      'url': base + '/' + page.slug
    };
    graph.push(glossarySchema);
    // FAQs work well for glossary entries
    var glossFaqs = _extractFaqsFromCopy(page.slug);
    if (glossFaqs.length >= 2) graph.push(_buildFaqPage(glossFaqs, page.slug));
  }

  // ── PODCAST PAGES ──
  if (type === 'podcast' || (page.slug && /podcast/i.test(page.slug))) {
    var podcastSchema = {
      '@type': 'PodcastSeries',
      '@id': base + '/' + page.slug + '#podcast',
      'name': page.page_name || '',
      'url': base + '/' + page.slug,
      'author': { '@id': base + '/#organization' }
    };
    if (page.meta_description) podcastSchema.description = page.meta_description;
    graph.push(podcastSchema);
  }

  // ── WEBINAR PAGES ──
  if (type === 'webinar' || (page.slug && /webinar/i.test(page.slug))) {
    var webinarSchema = {
      '@type': 'Event',
      '@id': base + '/' + page.slug + '#webinar',
      'name': page.page_name || '',
      'url': base + '/' + page.slug,
      'eventAttendanceMode': 'https://schema.org/OnlineEventAttendanceMode',
      'eventStatus': 'https://schema.org/EventScheduled',
      'organizer': { '@id': base + '/#organization' },
      'location': { '@type': 'VirtualLocation', 'url': base + '/' + page.slug }
    };
    if (page.meta_description) webinarSchema.description = page.meta_description;
    graph.push(webinarSchema);
    var webinarFaqs = _extractFaqsFromCopy(page.slug);
    if (webinarFaqs.length >= 2) graph.push(_buildFaqPage(webinarFaqs, page.slug));
  }

  // ── UTILITY PAGES (terms, privacy, legal) — minimal schema ──
  if (type === 'utility' || (page.slug && /terms|privacy|legal|disclaimer|cookie/i.test(page.slug))) {
    // Just WebPage (already added) — no special schema
    webPage['@type'] = 'WebPage';
    // But add the org as publisher for legal pages
    webPage.publisher = { '@id': base + '/#organization' };
  }

  // ── UNIVERSAL: Proof Bank stats as ClaimReview/QuantitativeValue ──
  var pb = (s.proofBank || {});
  if (pb.stats && pb.stats.length && ['home','service','industry','about','landing'].indexOf(type) >= 0) {
    pb.stats.forEach(function(stat) {
      if (stat.stat && stat.source) {
        webPage.citation = webPage.citation || [];
        webPage.citation.push({ '@type': 'CreativeWork', 'name': stat.stat, 'author': { '@type': 'Organization', 'name': stat.source } });
      }
    });
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

// ── External Validation ────────────────────────────────────────────────
function validateWithGoogle(slug) {
  var r = S.schema[slug];
  if (!r || !r.schema) return;
  // Extract JSON-LD from the schema output
  var jsonMatch = r.schema.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!jsonMatch) { if (typeof aiBarNotify === 'function') aiBarNotify('No JSON-LD found in schema', { isError: true }); return; }
  // Google Rich Results Test accepts code snippet via URL
  // Method: open with URL of the page (if live), or use code snippet approach
  var base = _schemaBaseUrl();
  var pageUrl = base + '/' + slug;
  // Try URL-based test first (works if page is live)
  var testUrl = 'https://search.google.com/test/rich-results?url=' + encodeURIComponent(pageUrl);
  window.open(testUrl, '_blank');
  if (typeof aiBarNotify === 'function') aiBarNotify('Opened Google Rich Results Test — if page is not live yet, use "Copy Schema" and paste into the code snippet tab', { duration: 5000 });
}

function validateWithSchemaOrg(slug) {
  var r = S.schema[slug];
  if (!r || !r.schema) return;
  var jsonMatch = r.schema.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!jsonMatch) return;
  // Schema.org validator accepts JSON input
  var testUrl = 'https://validator.schema.org/';
  window.open(testUrl, '_blank');
  // Copy the JSON to clipboard so user can paste
  var jsonText = jsonMatch[1].trim();
  if (navigator.clipboard) {
    navigator.clipboard.writeText(jsonText);
    if (typeof aiBarNotify === 'function') aiBarNotify('JSON-LD copied to clipboard — paste into the Schema.org validator', { duration: 4000 });
  }
}

// ── Validate All Schemas — batch internal validation ──────────────────
function validateAllSchemas() {
  var total = 0, passed = 0, richCount = 0, errorCount = 0, warnCount = 0;
  var richTypes = {};
  S.pages.forEach(function(page) {
    var r = S.schema[page.slug];
    if (!r || !r.schema) return;
    total++;
    var v = r.validation || { errors: [], warnings: [], richResults: [] };
    if (v.errors.length === 0) passed++;
    errorCount += v.errors.length;
    warnCount += v.warnings.length;
    v.richResults.forEach(function(rr) {
      richCount++;
      richTypes[rr.type] = (richTypes[rr.type] || 0) + 1;
    });
  });
  var summary = 'Validated ' + total + ' pages: ' + passed + ' clean, ' + errorCount + ' errors, ' + warnCount + ' warnings. ';
  summary += richCount + ' rich results eligible';
  if (Object.keys(richTypes).length) {
    summary += ' (' + Object.keys(richTypes).map(function(t) { return t + ': ' + richTypes[t]; }).join(', ') + ')';
  }
  if (typeof aiBarNotify === 'function') aiBarNotify(summary, { duration: 8000 });
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
          + '<button class="btn btn-ghost sm" onclick="validateWithGoogle(\'' + esc(p.slug) + '\')"><i class="ti ti-shield-check"></i> Google Test</button>'
          + '<button class="btn btn-ghost sm" onclick="validateWithSchemaOrg(\'' + esc(p.slug) + '\')"><i class="ti ti-code"></i> Schema.org Test</button>'
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
