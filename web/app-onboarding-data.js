// Shared onboarding datasets — ported from the mobile apps so the web signup
// collects and validates the same data. Exposed as window.DuvelaOnboardingData.
(function () {
  var countryDirectory = [
    { country: 'Argentina', cities: ['Buenos Aires', 'Cordoba', 'Mendoza', 'Rosario'] },
    { country: 'Australia', cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide'] },
    { country: 'Austria', cities: ['Vienna', 'Salzburg', 'Graz', 'Linz', 'Innsbruck'] },
    { country: 'Belgium', cities: ['Brussels', 'Antwerp', 'Ghent', 'Bruges', 'Leuven', 'Liege'] },
    { country: 'Brazil', cities: ['Sao Paulo', 'Rio de Janeiro', 'Brasilia', 'Salvador', 'Curitiba', 'Porto Alegre'] },
    { country: 'Bulgaria', cities: ['Sofia', 'Plovdiv', 'Varna', 'Burgas'] },
    { country: 'Canada', cities: ['Toronto', 'Vancouver', 'Montreal', 'Ottawa', 'Calgary', 'Edmonton'] },
    { country: 'China', cities: ['Beijing', 'Shanghai', 'Shenzhen', 'Guangzhou', 'Chengdu', 'Hangzhou'] },
    { country: 'Croatia', cities: ['Zagreb', 'Split', 'Dubrovnik', 'Rijeka', 'Zadar'] },
    { country: 'Czech Republic', cities: ['Prague', 'Brno', 'Ostrava', 'Plzen', 'Liberec'] },
    { country: 'Denmark', cities: ['Copenhagen', 'Aarhus', 'Odense', 'Aalborg'] },
    { country: 'Egypt', cities: ['Cairo', 'Alexandria', 'Giza'] },
    { country: 'Finland', cities: ['Helsinki', 'Espoo', 'Tampere', 'Turku'] },
    { country: 'France', cities: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Bordeaux', 'Lille', 'Strasbourg', 'Montpellier'] },
    { country: 'Germany', cities: ['Berlin', 'Munich', 'Hamburg', 'Cologne', 'Frankfurt', 'Stuttgart', 'Dusseldorf', 'Leipzig', 'Dresden', 'Bremen', 'Bonn', 'Hanover', 'Nuremberg'] },
    { country: 'Greece', cities: ['Athens', 'Thessaloniki', 'Patras', 'Heraklion'] },
    { country: 'Hungary', cities: ['Budapest', 'Debrecen', 'Szeged', 'Pecs', 'Gyor'] },
    { country: 'India', cities: ['Delhi', 'Mumbai', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata'] },
    { country: 'Indonesia', cities: ['Jakarta', 'Surabaya', 'Bandung', 'Yogyakarta', 'Denpasar'] },
    { country: 'Ireland', cities: ['Dublin', 'Cork', 'Galway', 'Limerick'] },
    { country: 'Italy', cities: ['Rome', 'Milan', 'Naples', 'Turin', 'Florence', 'Bologna', 'Venice', 'Verona', 'Palermo', 'Bari'] },
    { country: 'Japan', cities: ['Tokyo', 'Osaka', 'Kyoto', 'Yokohama', 'Sapporo', 'Nagoya'] },
    { country: 'Mexico', cities: ['Mexico City', 'Guadalajara', 'Monterrey', 'Cancun', 'Puebla'] },
    { country: 'Morocco', cities: ['Casablanca', 'Rabat', 'Marrakech', 'Tangier'] },
    { country: 'Netherlands', cities: ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven', 'Groningen', 'Maastricht'] },
    { country: 'New Zealand', cities: ['Auckland', 'Wellington', 'Christchurch'] },
    { country: 'Norway', cities: ['Oslo', 'Bergen', 'Trondheim', 'Stavanger'] },
    { country: 'Poland', cities: ['Warsaw', 'Krakow', 'Wroclaw', 'Gdansk', 'Poznan', 'Lodz', 'Katowice'] },
    { country: 'Portugal', cities: ['Lisbon', 'Porto', 'Braga', 'Coimbra', 'Faro', 'Aveiro', 'Funchal'] },
    { country: 'Romania', cities: ['Bucharest', 'Cluj-Napoca', 'Timisoara', 'Brasov', 'Iasi', 'Constanta'] },
    { country: 'Saudi Arabia', cities: ['Riyadh', 'Jeddah', 'Dammam'] },
    { country: 'Serbia', cities: ['Belgrade', 'Novi Sad', 'Nis'] },
    { country: 'Singapore', cities: ['Singapore'] },
    { country: 'South Africa', cities: ['Cape Town', 'Johannesburg', 'Durban', 'Pretoria'] },
    { country: 'South Korea', cities: ['Seoul', 'Busan', 'Incheon', 'Daegu'] },
    { country: 'Spain', cities: ['Madrid', 'Barcelona', 'Valencia', 'Seville', 'Malaga', 'Bilbao', 'Granada', 'Zaragoza', 'Alicante', 'Palma'] },
    { country: 'Sweden', cities: ['Stockholm', 'Gothenburg', 'Malmo', 'Uppsala'] },
    { country: 'Switzerland', cities: ['Zurich', 'Geneva', 'Basel', 'Bern', 'Lausanne', 'Lucerne'] },
    { country: 'Thailand', cities: ['Bangkok', 'Chiang Mai', 'Phuket', 'Pattaya'] },
    { country: 'Turkey', cities: ['Istanbul', 'Ankara', 'Izmir', 'Antalya', 'Bursa', 'Adana'] },
    { country: 'Ukraine', cities: ['Kyiv', 'Lviv', 'Odesa', 'Kharkiv', 'Dnipro', 'Vinnytsia'] },
    { country: 'United Arab Emirates', cities: ['Dubai', 'Abu Dhabi', 'Sharjah'] },
    { country: 'United Kingdom', cities: ['London', 'Manchester', 'Birmingham', 'Liverpool', 'Bristol', 'Leeds', 'Edinburgh', 'Glasgow'] },
    { country: 'United States', cities: ['New York', 'Los Angeles', 'Chicago', 'Miami', 'Boston', 'Seattle', 'San Francisco', 'Washington'] },
    { country: 'Vietnam', cities: ['Hanoi', 'Ho Chi Minh City', 'Da Nang', 'Nha Trang'] }
  ];

  function normalize(value) {
    return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function ranked(items, query, limit) {
    var q = normalize(query);
    if (!q) return [];
    var starts = [], contains = [];
    for (var i = 0; i < items.length; i++) {
      var n = normalize(items[i]);
      if (n.indexOf(q) === 0) starts.push(items[i]);
      else if (n.indexOf(q) !== -1) contains.push(items[i]);
    }
    return starts.concat(contains).slice(0, limit || 8);
  }

  function findCountry(country) {
    var n = normalize(country);
    for (var i = 0; i < countryDirectory.length; i++) {
      if (normalize(countryDirectory[i].country) === n) return countryDirectory[i];
    }
    return null;
  }

  var api = {
    LANGUAGES: ['German', 'English', 'Spanish', 'French', 'Italian', 'Portuguese', 'Dutch', 'Russian', 'Ukrainian', 'Turkish', 'Arabic', 'Chinese', 'Japanese'],
    LEVELS: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    GENDERS: [{ id: 'male', label: 'Male' }, { id: 'female', label: 'Female' }, { id: 'other', label: 'Other' }],
    CATEGORIES: [
      { id: 'languages', label: 'Languages' },
      { id: 'art', label: 'Art & creativity' },
      { id: 'education', label: 'Education' },
      { id: 'digital', label: 'Digital skills' },
      { id: 'career', label: 'Career' },
      { id: 'life', label: 'Life skills' },
      { id: 'sportFitness', label: 'Sport & fitness' },
      { id: 'personalDevelopment', label: 'Personal development' }
    ],
    SUBCATEGORIES: {
      art: ['Drawing', 'Painting', 'Sculpture', 'Animation', 'Graphic design', 'Crafts', 'Art history'],
      career: ['Interview preparation', 'AI interview'],
      digital: ['Programming', 'Web development', 'Mobile development', 'UI/UX', 'Figma', 'Video editing', 'Content creation', 'Audio & podcast', 'Digital marketing', 'Social media', 'SEO'],
      education: ['Math', 'Physics', 'Chemistry', 'Biology', 'Logic'],
      life: ['Sign language', 'Cooking', 'Personal finance', 'Home organization'],
      personalDevelopment: ['Mindfulness', 'Communication', 'Productivity', 'Confidence'],
      sportFitness: ['Running', 'Fitness', 'Yoga', 'Cycling', 'Chess']
    },
    INTERESTS: [
      { icon: '🎥', id: 'entertainment', label: 'Entertainment' }, { icon: '🏀', id: 'sports', label: 'Sports' },
      { icon: '🛩️', id: 'travel', label: 'Travel' }, { icon: '🍿', id: 'cinema', label: 'Cinema' },
      { icon: '💻', id: 'business', label: 'Business' }, { icon: '🕺', id: 'dancing', label: 'Dancing' },
      { icon: '🌸', id: 'socializing', label: 'Socializing' }, { icon: '🗿', id: 'culture', label: 'Culture' },
      { icon: '🌳', id: 'gardening', label: 'Gardening' }, { icon: '💌', id: 'dating', label: 'Dating' },
      { icon: '🧘', id: 'yoga', label: 'Yoga' }, { icon: '🛍️', id: 'shopping', label: 'Shopping' },
      { icon: '📷', id: 'photography', label: 'Photography' }, { icon: '🍔', id: 'food', label: 'Food' },
      { icon: '🚲', id: 'biking', label: 'Biking' }, { icon: '👨‍👩‍👧', id: 'family', label: 'Family' },
      { icon: '🧶', id: 'handcraft', label: 'Handcraft' }, { icon: '🍳', id: 'cooking', label: 'Cooking' },
      { icon: '⛳', id: 'golf', label: 'Golf' }, { icon: '🎵', id: 'music', label: 'Music' },
      { icon: '🔬', id: 'tech', label: 'Tech' }, { icon: '🧪', id: 'science', label: 'Science' },
      { icon: '💼', id: 'interview', label: 'Interview' }, { icon: '🎨', id: 'art', label: 'Art' },
      { icon: '💬', id: 'chatting', label: 'Chatting' }, { icon: '🎮', id: 'gaming', label: 'Gaming' },
      { icon: '💰', id: 'finance', label: 'Finance' }
    ],
    getCountrySuggestions: function (query, limit) {
      return ranked(countryDirectory.map(function (x) { return x.country; }), query, limit);
    },
    getCitySuggestions: function (query, country, limit) {
      var match = findCountry(country);
      var pool = match ? match.cities : countryDirectory.reduce(function (acc, x) { return acc.concat(x.cities); }, []);
      return ranked(pool, query, limit);
    },
    isKnownCountry: function (country) { return !!findCountry(country); },
    doesCityBelongToCountry: function (city, country) {
      var match = findCountry(country);
      if (!match) return false;
      var n = normalize(city);
      return match.cities.some(function (c) { return normalize(c) === n; });
    },
    // Which known country a city belongs to (null if the city isn't in the
    // dataset). Used to flag only clear mismatches (e.g. Paris + Germany) while
    // still allowing valid cities that aren't in our curated list.
    cityCountry: function (city) {
      var n = normalize(city);
      for (var i = 0; i < countryDirectory.length; i++) {
        if (countryDirectory[i].cities.some(function (c) { return normalize(c) === n; })) return countryDirectory[i].country;
      }
      return null;
    }
  };

  window.DuvelaOnboardingData = api;
})();
