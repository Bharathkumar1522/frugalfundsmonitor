let menu = document.querySelector('.menu_');
let toggle = document.querySelector('.toggle_');
let toggle_symbol = document.querySelector('#toggle-symbol')
toggle.addEventListener('click', () => {
  menu.classList.toggle('active');
  toggle_symbol.classList.toggle('fa-xmark');
});


document.addEventListener('DOMContentLoaded', function() {
  const dropdown = document.getElementById('dropdown');
  const toggleDropdown = function() {
    document.addEventListener('click', function(e) {
      if (e.target.parentElement.classList.contains('dropdown-menu') || e.target.classList.contains('dropdown-item')) {
        return;
      }
      dropdown.classList.toggle('show');
    });
  };
  dropdown.addEventListener('shown.bs.dropdown', toggleDropdown);
});
// Get the date input element
var dateInput = document.getElementById('transaction-date-input');
// Get the current date
var today = new Date();
var dd = String(today.getDate()).padStart(2, '0');
var mm = String(today.getMonth() + 1).padStart(2, '0'); // January is 0!
var yyyy = today.getFullYear();
var currentDate = yyyy + '-' + mm + '-' + dd;

// Set the max attribute to the current date
dateInput.setAttribute('max', currentDate);