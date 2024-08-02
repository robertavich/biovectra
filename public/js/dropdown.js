document.querySelectorAll('.custom-select').forEach(select => {
    const selected = select.querySelector('.select-selected');
    const options = select.querySelector('.select-items');

    selected.addEventListener('click', function () {

        // Close other dropdowns
        document.querySelectorAll('.select-items').forEach(item => {
            if (item !== options) {
                item.classList.add('hide');
            }
        });
        options.classList.toggle('hide');
    });

    options.querySelectorAll('div').forEach(option => {
        option.addEventListener('click', function () {
            removeFolder();
            const input = document.getElementById('input-excel');
            selected.textContent = this.textContent;

            if (this.textContent.trim() == "Bill Of Material") {

                input.setAttribute('webkitdirectory', '');
                input.setAttribute('multiple', '');
                document.getElementById("batches").classList.remove("hide")
            } else {
                input.removeAttribute('webkitdirectory');
                input.setAttribute('multiple', '');
                document.getElementById("batches").classList.add("hide")
            }
            options.classList.add('hide');
        });
    });

    document.addEventListener('click', function (event) {
        if (!select.contains(event.target)) {
            options.classList.add('hide');
        }
    });
});