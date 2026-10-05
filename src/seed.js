import seeds from './tableSeeds.json';
export const today = () => new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Kolkata'});
const facultyNames = ['Dr. Anand H.','Prof. Meera Nair','Dr. Jacob Varghese','Prof. Arunima S.','Mr. Sreejith K.','Dr. Radhika Mohan'];
const departments = ['Computer Science & Engg.','Electronics & Communication','Mechanical Engineering','Artificial Intelligence & DS','Civil Engineering','Electrical & Electronics'];
const roles = ['Head of Department','Associate Professor','Dean Research / Professor','Assistant Professor','Lab Superintendent','Professor • PG Dean'];
export const initialFaculty = seeds['Faculty-0'].rows.map((r,i)=>({id:r.cells[0].match(/FAC-[A-Z]+-\d+/)[0], name:facultyNames[i], department:departments[i], dept:['CSE','ECE','ME','AI&DS','CE','EEE'][i], designation:roles[i], permit:r.cells[2].replace(/^(directions_car|two_wheeler) /,''), privilege:r.cells[3], afterHours:![3,4].includes(i), protocol:i===3||i===4?'Require Vehicle Log':'Instant Pass (No Prompt)', present:i!==4, status:'ACTIVE', role:'Staff', img:r.img}));
initialFaculty.push({id:'VIS-MB-003',name:'Mr. Kishore George',department:'MBA Department',dept:'BS',designation:'Visiting Executive Faculty',permit:'VIS-8812',privilege:'Visiting Scholar Reference Only',afterHours:false,protocol:'Visual Confirmation Required',present:false,status:'ACTIVE',role:'Staff'});
initialFaculty.push({id:'FAC-EC-083',name:'Dr. Ramesh Narayanan',department:'Electronics & Communication',dept:'ECE',designation:'Professor',permit:'ASIET-P-091',privilege:'Tier-1 Unlimited Faculty Borrowing',afterHours:true,protocol:'Instant Pass (No Prompt)',present:true,status:'ACTIVE',role:'Staff'});
const logNames=['Arjun Menon','Dr. Radhika Nair','Rahul S.','Ananya P.','Prof. K. V. Suresh','Devika Nambiar','Manoj Kumar K.','Gautham Mohan','Sneha Mariam'];
export const initialLogs = seeds['Logs-0'].rows.map((r,i)=>({key:`seed-${i}`,id:r.cells[2],name:logNames[i],profile:r.cells[3].slice(logNames[i].length).trim(),department:r.cells[4],gate:'Gate 1',source:r.cells[6],time:r.cells[1],direction:r.cells[0].includes('DENIED')?'DENIED':r.cells[0].startsWith('IN')?'IN':'OUT',date:today(),role:r.cells[2].startsWith('FAC')?'Staff':r.cells[2].startsWith('STF')?'Staff':'Student',img:r.img}));
export const initialRecords=[
 {id:'LIB-001',name:'Demo Librarian',role:'Librarian',department:'Library',course:'Librarian',barcode:'LIB-001',status:'ACTIVE',privilege:'Library administration'},
 {id:'ASI22CS084',name:'Arjun Menon',role:'Student',department:'Computer Science & Engineering',course:'B.Tech Semester 6',barcode:'ASIET-2022-CS-084',status:'ACTIVE',privilege:'Tier-1 Full Access'},
 {id:'ASIET-CS-2022-041',name:'Ananya K. Menon',role:'Student',department:'Computer Science & Eng. (S6)',status:'ACTIVE',privilege:'24/7 Hostel + Academic'},
 {id:'ASIET-ME-2023-118',name:'Siddharth V. Pillai',role:'Student',department:'Mechanical Engineering (S4)',status:'SUSPENDED',privilege:'Perimeter Only (07:30–18:30)'},
 {id:'ASIET-STF-EEE-051',name:'Lakshmi Mohan',role:'Staff',department:'Electrical & Electronics Labs',status:'ACTIVE',privilege:'Campus + Lab Complex'},
 ...initialLogs.filter(r=>r.id!=='ASI22CS084').map(r=>({id:r.id,name:r.name,department:r.department,role:r.role,status:r.direction==='DENIED'?'SUSPENDED':'ACTIVE',privilege:'Standard campus access',course:r.department})),
 ...initialFaculty.filter(f=>!initialLogs.some(r=>r.id===f.id)).map(f=>({...f,course:f.designation}))
];
