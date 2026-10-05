import React from 'react';

export const collegeName = 'Adi Sankara Institute of Engineering and Technology';

export function CollegeLogo() {
  return <img className="college-logo" src="/college-logo.png" alt={`${collegeName} logo`} width="82" height="80" />;
}

export function CampusPhoto() {
  return <figure className="campus-photo"><img src="/college-campus.jpg" alt={`Main entrance of ${collegeName}, Kalady`} width="547" height="366" /><figcaption><span>Our campus</span><strong>{collegeName}</strong><span>Kalady, Kerala</span></figcaption></figure>;
}
