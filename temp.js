// const products = [
//   {id: 1, name: "Apple", price: 120, category: "fruits", quantity: 2},
//   {id: 2, name: "Milk", price: 60, category: "dairy", quantity: 1},
//   {id: 3, name: "Bread", price: 40, category: "fruits", quantity: 3},
//   {id: 4, name: "Banana", price: 80, category: "fruits", quantity: 5},
//   {id: 5, name: "Cheese", price: 200, category: "dairy", quantity: 1},
//   {id: 6, name: "Cookies", price: 150, category: "dairy", quantity: 2}
// ];

// function groupBy(products,cat){
//     return products.reduce((groups,item)=>{
//         const group = item[cat];
//         groups[group] = groups[group] || [];
//         groups[group].push(item);
//         return groups;
//     },{})
// }
// let result = groupBy(products,'category');
// console.log(result);

// const prices = products.filter(e=> e.price<120);
// console.log(prices);

// let filtering = products.find(e=> e.name === 'Apple');


// let sum = products.reduce((prev,curr)=>{
//     return prev+curr.price;
// },0); 
// console.log(sum)


// const show = document.getElementById('count')
// let counter = 0;
// document.getElementById('increment').addEventListener('click',function(){
//         counter++;
//         show.textContent = `Counter : ${counter}`
//     })
// document.getElementById('decrement').addEventListener('click',function(){
//         counter--;
//         show.textContent = `Counter : ${counter}`
//     })


// function total(cartitems){
//     return cartitems.reduce((prev,curr)=>{
//         return prev + curr;
//     },0)
// }

// TWOSUM

// const numbers = [9, 6, 4, 2, 3, 5, 7, 0, 1];
// numbers.sort((a,b)=> a-b);
// function sorting(target,numbers){
//     let first = 0;
//     let second = numbers.length-1;
//     while(first<=second){
//         let sum = numbers[first]+numbers[second];
//         if(sum==target){
//             return [numbers[first],numbers[second]];
//         }else if(sum>target){
//             second--;
//         }else{
//             first++;
//         }
//     }
//     return [-1,-1];
// }
// const result = sorting(13,numbers);
// console.log(result);


// const fruits = ["apple", "banana", "apple", "orange", "banana"];

// console.log(Math.max(...fruits));


// function filering(cat) {
//     return products.filter(ele=> ele.category===cat);
// }
// const filter = products.filter(e=>e.category==="fruit")
// console.log(filter);


// for (var i = 0; i < 3; i++) {
//     (function(j){
//         setTimeout(() => console.log(j), 100);
//     })(i);
// }

// const obj = {
//   name: "blinkit",
//   getName: function() { return this.name; },
//   getNameArrow: () => { return this.name; }
// }
// console.log(obj.getName());
// console.log(obj.getNameArrow());

// function addf(x){
//     return (y) => x+y;
// }
// let c = addf(5);
// console.log(c(10));
// console.log(c(5));

// function check(x){
//     return x%1==0 ? true : false;
// }

// console.log(check(12.2));


// return function (){
//     console.log("hello sarhtka")
// }

// CALLBACK
// function print(abc){
//     abc();
// }
// function abc(){
//     console.log("My name is sarthak");
// }
// print(abc)

// const result = duplicates(arr);
// console.log(result)

// let str = "My name is sarthak"
// function search(substr){
//         return str.split('').filter(e=>e===substr)
//     }

//     const result = search('sa');
//     console.log(result);

// const arr = [7, 2, 3, 0, 4, 5, 1];
// function findmissing(arr){
//     let n = arr.length;
//     let expsum = n * (n+1) /2;
//     let actualsum = arr.reduce((prev,curr)=>{
//         return prev+curr;
//     },0)
//     return expsum - actualsum;
// }
// const result = findmissing(arr);
// console.log(result);


// REVERSE
// let str= "Sarthak";
// function reverse(string){
//     return string.split('').reverse().join('').split(' ').reverse().join('');
// }
// const result = reverse(str);
// console.log(result);

// const b = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10,11];

// for (let i = 0; i < 10; i++) {
//   setTimeout(() => console.log(b[i]), 1000);
// }

// for (var i = 0; i < 10; i++) {
//   setTimeout(() => console.log(b[i]), 1000);
// }

// let x = 32;
// let y = '32';
// console.log((x==y));
// console.log((x.toString()===y));

// const person = {
//     name:"Sarthak",
//     greet : ()=>{
//         console.log(this.name);
//     }
// };
// person.greet();

// const arr = ["sarthak",1,4,'askhdbsa',5,1,"asbdh"];
// let sum = arr
//     .filter(e => typeof e==='number')
//     .reduce((prev,curr)=>{
//         return prev+curr;
//     },0)
// console.log(sum);
// const arr = ["sarthak",1,4,'askhdbsa',5,1,"asbdh"];
// let sum =0;

// arr.forEach((e) => {
//     if(typeof e === 'number'){
//         sum += e;
//     }
// })

// console.log(sum);


// DUPLICATES USING FLOYDS
// const numbers = [9, 6, 4, 2, 3, 5, 7, 0, 1, 7];
// function duplicates(a) {
//     let slow = a[0];
//     let fast = a[0];
//     do {
//         slow = a[slow];
//         fast = a[a[fast]];
//     } while (slow !== fast)
//     slow = a[0];
//     while (slow !== fast) {
//         slow = a[slow];
//         fast = a[fast];
//     }
//     return a[slow];
// }
// const result = duplicates(numbers);
// console.log(result);


// FINDING FREQ OF EACH CHARACTER
// let string = "abccbad";
// function occ(s){
//     const freq = {};
//     for(let e of s){
//         freq[e] = freq[e] ? freq[e]+1 : 1;
//     }
//     return freq;
// }   
// let result = occ(string);
console.log(result);    


// let string = "abcdedcba";
// function palindrome(s){
//     let x = 0;
//     let y = s.length-1;
//     while(x<y){
//         if(s[x++]!==s[y--]){
//             return false;
//         }
//     }
//     return true;
// }
// let result = palindrome(string);
// console.log(result);

// FLATTEN ARRAY
// const nested = [1, [2, 3], [4, [5, 6]], 7];
// console.log(nested.toString().split(',').map(Number))


// FINDING FIRST DUPLICATE ELEMENT
// let string = "abccbad";
// function check(s){
//     const freq = {};
//     for(let e of s){
//         freq[e] = freq[e]? freq[e]+1 : 1;
//     }
//     for(let e in freq){
//         if(freq[e]==1){
//             return e;
//         }
//     }
//     return -1;
// }
// let result = check(string);
// console.log(result); 

// FIRST CHARACTER TO UPPER CASE
function titleCase(str) {
    return str.split(' ').map(word=>word.charAt(0).toUpperCase()+word.slice(1).toLowerCase()).jon(' ')
}
console.log(titleCase("hello world javascript"));


// for (var i = 0; i < 3; i++) {
//     (function(j){
//         setTimeout(() => console.log(j), 100);
//     })(i);
// }
