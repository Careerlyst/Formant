const KEY='careerlyst_demo'
const seed={user:null,orders:[],messages:[],files:[],notifications:[],profile:{name:'',email:''},queue:{active:2,capacity:2,waiting:3}}
export function load(){try{return {...seed,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return seed}}
export function save(data){localStorage.setItem(KEY,JSON.stringify(data));window.dispatchEvent(new Event('careerlyst-store'));return data}
export function patch(fn){return save(fn(load()))}
export function logout(){patch(s=>({...s,user:null}))}
export function demoLogin(email,name='Demo Client'){patch(s=>({...s,user:{email,name},profile:{...s.profile,name,email}}))}
export const services=[
 {id:'resume',name:'Resume / CV',desc:'A focused, role-specific resume built for clarity, relevance and ATS readability.',price:'From $19'},
 {id:'linkedin',name:'LinkedIn',desc:'A sharper LinkedIn presence that aligns your headline, story and target role.',price:'From $29'},
 {id:'github',name:'GitHub',desc:'A cleaner developer profile that makes your work easier to understand.',price:'From $29'},
 {id:'portfolio',name:'Portfolio',desc:'A polished portfolio that turns projects into credible evidence.',price:'From $79'},
 {id:'cover',name:'Cover Letter',desc:'A concise, specific letter tailored to the opportunity.',price:'From $19'},
 {id:'interview',name:'Interview Preparation',desc:'Targeted preparation, practice and feedback for the role ahead.',price:'From $49'}
]
